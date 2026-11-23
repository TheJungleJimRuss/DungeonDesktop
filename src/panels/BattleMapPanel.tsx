import { useEffect, useMemo, useRef, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { useActiveEncounter } from "../storage/encounters";
import { distanceFeet, distanceSquares, type Square } from "../battle/measure";
import { MAX_SQUARES, clampInt, freeSquare, updateBattleMap, useBattleMap, toStoredImage, withCombatantTokens, type BattleMap, type StoredImage, type Token } from "../storage/battleMaps";
import { isDefeated, type Encounter } from "../combat/rules";
import { pickCombatant, useCombatPick } from "../combat/combatSelection";
import { Loading } from "../ui/PanelStates";
import { tokenLabel } from "../battle/tokens";
import { reachArea } from "../battle/speed";
import { useCombatantSpeed } from "../battle/useCombatantSpeed";

const CELL = 40;
const MAX_LINES = 120; // more grid lines than this across the view: draw every 2nd, 4th, ... so it stays a grid, not a smear
const MAX_RULER_SQUARES = 4000; // labelled ruler squares are drawn only while this few are in view; the overlay measures the rest
const ZOOM_STEP = 1.5; // each click multiplies/divides the zoom; there is no upper or lower limit, like the World Map

type View = { zoom: number; centre: { x: number; y: number } };
const viewKey = (encounterId: string) => `dungeon-desktop:battle-map-view:${encounterId}`;
/** The saved zoom and centre for an Encounter's map (this device only), or null for the default fit view. */
function readView(encounterId: string): View | null {
  try {
    const v = JSON.parse(localStorage.getItem(viewKey(encounterId)) ?? "null");
    if ([v?.zoom, v?.x, v?.y].every((n) => typeof n === "number" && Number.isFinite(n)) && v.zoom > 0) return { zoom: v.zoom, centre: { x: v.x, y: v.y } };
  } catch { /* no saved view */ }
  return null;
}
const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad", "#7f8c8d"];

/** Object URL for a Blob, revoked when the Blob changes or the panel goes away. */
function useObjectUrl(img?: StoredImage): string | undefined {
  const url = useMemo(() => (img ? URL.createObjectURL(new Blob([img.data], { type: img.type })) : undefined), [img]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function Grid({ campaignId, enc }: { campaignId: string; enc: Encounter }) {
  const encounterId = enc.id;
  const map = useBattleMap(campaignId, encounterId);
  const pick = useCombatPick(campaignId);
  const selectedId = pick && pick.activeId === enc.activeId ? pick.combatantId : undefined; // lapses when the turn moves, like the Stat Block panel
  // A linked token is its Combatant: the name comes from there, defeat marks or hides it.
  const shown = map.tokens.flatMap((t) => {
    if (!t.combatantId) return [{ t, name: t.name, defeated: false, selected: false }];
    const c = enc.combatants.find((x) => x.id === t.combatantId);
    if (!c || (isDefeated(c) && enc.defeatMode === "remove")) return [];
    return [{ t, name: c.name, defeated: isDefeated(c), selected: c.id === selectedId }];
  });
  // Speed ring: only the selected token, drawn from where it stands (it stays put while dragging, so the drop can be judged).
  const selectedToken = shown.find((s) => s.selected && !s.defeated)?.t;
  const speedFeet = useCombatantSpeed(campaignId, enc.combatants.find((c) => c.id === selectedToken?.combatantId));
  const select = (t: Token) => { if (t.combatantId) pickCombatant(campaignId, { combatantId: t.combatantId, activeId: enc.activeId }); };
  const bg = map.background;
  const bgUrl = useObjectUrl(bg?.image);
  const bgScale = bg?.scale ?? 1, bgX = bg?.offsetX ?? 0, bgY = bg?.offsetY ?? 0;
  const patchBg = (p: Partial<NonNullable<BattleMap["background"]>>) => void change((m) => ({ ...m, background: { ...m.background, ...p } }));
  const setBgNumber = (key: "scale" | "offsetX" | "offsetY", v: string) => {
    const n = Number(v);
    if (v.trim() !== "" && Number.isFinite(n) && (key !== "scale" || n > 0)) patchBg({ [key]: n });
  };
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  // Ruler: transient, never saved. `locked` = the end square is chosen.
  const [ruler, setRuler] = useState(false);
  const [rule, setRule] = useState<{ a: Square; b: Square; locked: boolean } | null>(null);
  // Zoom scales the whole canvas as one: the viewBox shrinks (zoom in) or widens (zoom out) around `centre`.
  // null = the fit view (zoom 1, centred), which follows the grid when its size changes.
  const [view, setView] = useState<View | null>(() => readView(encounterId));
  useEffect(() => {
    try {
      if (view) localStorage.setItem(viewKey(encounterId), JSON.stringify({ zoom: view.zoom, x: view.centre.x, y: view.centre.y }));
      else localStorage.removeItem(viewKey(encounterId));
    } catch { /* not saved */ }
  }, [encounterId, view]);
  const W = map.width * CELL, H = map.height * CELL;
  const zoom = view?.zoom ?? 1, centre = view?.centre ?? { x: W / 2, y: H / 2 };
  const vw = W / zoom, vh = H / zoom;
  const box = { x: centre.x - vw / 2, y: centre.y - vh / 2, w: vw, h: vh };
  // The grid carries on past the map area: lines and ruler squares cover whatever is in view.
  const cols = { lo: Math.floor(box.x / CELL), hi: Math.ceil((box.x + box.w) / CELL) };
  const rows = { lo: Math.floor(box.y / CELL), hi: Math.ceil((box.y + box.h) / CELL) };
  const stride = 2 ** Math.max(0, Math.ceil(Math.log2(Math.max(cols.hi - cols.lo, rows.hi - rows.lo) / MAX_LINES)));
  const lines = (r: { lo: number; hi: number }) => { const out: number[] = []; for (let i = Math.ceil(r.lo / stride) * stride; i <= r.hi; i += stride) out.push(i); return out; };
  const visibleSquares = (cols.hi - cols.lo) * (rows.hi - rows.lo);
  const zoomBy = (k: number) => setView({ zoom: zoom * k, centre });
  const panning = useRef<{ x: number; y: number } | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const change = (fn: (m: BattleMap) => BattleMap) => updateBattleMap(campaignId, encounterId, fn);
  const setSize = (key: "width" | "height", v: string) => {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1) void change((m) => ({ ...m, [key]: clampInt(n, 1, MAX_SQUARES) }));
  };
  const commitOnEnter = (e: React.KeyboardEvent) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); };
  const setFeet = (v: string) => { const n = Number(v); if (n > 0) void change((m) => ({ ...m, feetPerSquare: n })); };
  const placed = new Set(map.tokens.map((t) => t.combatantId));
  /** Link a token to a Combatant (it then follows that name), or unlink it (it keeps the name it showed as its own). */
  const relink = (t: Token, current: string, combatantId: string) => {
    const c = enc.combatants.find((x) => x.id === combatantId);
    void patchToken(t.id, c ? { combatantId: c.id, name: c.name } : { combatantId: undefined, name: current });
  };
  const patchToken = (id: string, p: Partial<Token>) => change((m) => ({ ...m, tokens: m.tokens.map((t) => (t.id === id ? { ...t, ...p } : t)) }));

  const square = (e: React.PointerEvent) => {
    const el = svg.current, ctm = el?.getScreenCTM?.();
    if (!el || !ctm) return null;
    const pt = el.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: Math.floor(p.x / CELL), y: Math.floor(p.y / CELL) }; // the grid never ends
  };
  // Click start then end, or press on one square and release on another; both snap to squares.
  const rulerDown = (q: Square) => { if (!rule || rule.locked) setRule({ a: q, b: q, locked: false }); };
  const rulerOver = (q: Square) => { if (rule && !rule.locked && (q.x !== rule.b.x || q.y !== rule.b.y)) setRule({ ...rule, b: q }); };
  const rulerEnd = (q: Square) => { if (rule && !rule.locked && (q.x !== rule.a.x || q.y !== rule.a.y)) setRule({ ...rule, b: q, locked: true }); };
  const toggleRuler = () => { setRuler((r) => !r); setRule(null); };
  const nudge = (t: Token, e: React.KeyboardEvent) => {
    const d = KEYS[e.key];
    if (!d) return;
    e.preventDefault();
    void change((m) => ({ ...m, tokens: m.tokens.map((k) => (k.id === t.id ? { ...k, x: k.x + d[0], y: k.y + d[1] } : k)) })); // deltas, so key repeats never lose a step
  };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void change((m) => ({ ...m, tokens: [...m.tokens, { id: crypto.randomUUID(), name: name.trim(), color, ...freeSquare(m) }] }));
    setName("");
  };

  return (
    <div className="battle-map">
      <div className="row map-toolbar">
        <button aria-pressed={ruler} onClick={toggleRuler}>Ruler</button>
        <span className="row zoom-ctl" role="group" aria-label="Zoom">
          <button aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>−</button>
          <span className="muted" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>+</button>
          <button aria-pressed={view === null} onClick={() => setView(null)} title="Show the whole map">Fit</button>
        </span>
        {rule && <button onClick={() => setRule(null)}>Clear measurement</button>}
        {rule && <span role="status" aria-label="Measured distance">{distanceSquares(rule.a, rule.b)} squares, {distanceFeet(rule.a, rule.b, map.feetPerSquare)} ft</span>}
      </div>
      <details className="map-settings">
        <summary>Map settings <span className="muted" aria-label="Grid summary">{map.width} × {map.height} squares, {map.feetPerSquare} ft per square</span></summary>
      <div className="row">
        <label>Width <input aria-label="Grid width" onKeyDown={commitOnEnter} type="number" min={1} max={MAX_SQUARES} defaultValue={map.width} key={`w${map.width}`} onBlur={(e) => setSize("width", e.target.value)} /></label>
        <label>Height <input aria-label="Grid height" onKeyDown={commitOnEnter} type="number" min={1} max={MAX_SQUARES} defaultValue={map.height} key={`h${map.height}`} onBlur={(e) => setSize("height", e.target.value)} /></label>
        <label>Feet per square <input aria-label="Feet per square" onKeyDown={commitOnEnter} type="number" min={1} step="any" defaultValue={map.feetPerSquare} key={`f${map.feetPerSquare}`} onBlur={(e) => setFeet(e.target.value)} /></label>
      </div>
      <div className="row">
        <label>Background image <input aria-label="Background image" type="file" accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void toStoredImage(f).then((image) => patchBg({ image })); e.target.value = ""; }} /></label>
        {bg?.image && <>
          <label>Scale <input aria-label="Background scale" type="number" min={0.1} step="any" defaultValue={bgScale} key={`s${bgScale}`} onKeyDown={commitOnEnter} onBlur={(e) => setBgNumber("scale", e.target.value)} /></label>
          <label>Offset X <input aria-label="Background offset X" type="number" step="any" defaultValue={bgX} key={`x${bgX}`} onKeyDown={commitOnEnter} onBlur={(e) => setBgNumber("offsetX", e.target.value)} /></label>
          <label>Offset Y <input aria-label="Background offset Y" type="number" step="any" defaultValue={bgY} key={`y${bgY}`} onKeyDown={commitOnEnter} onBlur={(e) => setBgNumber("offsetY", e.target.value)} /></label>
          <button onClick={() => void change((m) => { const { background: _drop, ...rest } = m; return rest; })}>Clear background</button>
        </>}
      </div>
      </details>
      <div className="battle-scroll fit">
      <svg ref={svg} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className={"map-canvas battle-grid" + (bgUrl ? " has-bg" : "")} role="group" aria-label="Battle grid">
        {/* Drag the background (anywhere off a token) to pan. */}
        <rect x={box.x} y={box.y} width={box.w} height={box.h} className="battle-bg" data-testid="battle-pan"
          onPointerDown={(e) => { panning.current = { x: e.clientX, y: e.clientY }; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => {
            const last = panning.current, el = svg.current;
            if (!last || !el) return;
            const r = el.getBoundingClientRect();
            const k = Math.max(box.w / (r.width || box.w), box.h / (r.height || box.h)); // letterboxed: the tighter side sets the scale
            setView({ zoom, centre: { x: centre.x - (e.clientX - last.x) * k, y: centre.y - (e.clientY - last.y) * k } });
            panning.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => { panning.current = null; }} />
        {bgUrl && <image href={bgUrl} x={bgX * CELL} y={bgY * CELL} width={map.width * CELL * bgScale} height={map.height * CELL * bgScale} preserveAspectRatio="xMinYMin meet" pointerEvents="none" aria-hidden="true" />}
        {lines(cols).map((i) => <line key={`v${i}`} x1={i * CELL} y1={box.y} x2={i * CELL} y2={box.y + box.h} className="grid-line" pointerEvents="none" />)}
        {lines(rows).map((i) => <line key={`h${i}`} x1={box.x} y1={i * CELL} x2={box.x + box.w} y2={i * CELL} className="grid-line" pointerEvents="none" />)}
        <rect x={0} y={0} width={W} height={H} className="battle-area" pointerEvents="none" aria-hidden="true" />
        {selectedToken && speedFeet !== null && (() => {
          const r = reachArea(selectedToken, speedFeet, map.feetPerSquare, map);
          return (
            <g className="speed-ring" data-testid="speed-ring" pointerEvents="none" aria-label={`Speed ${speedFeet} ft, ${r.squares} squares`}>
              <rect x={r.x * CELL + 2} y={r.y * CELL + 2} width={r.w * CELL - 4} height={r.h * CELL - 4} rx={CELL / 2} />
              <text x={r.x * CELL + 10} y={r.y * CELL + 22}>{speedFeet} ft</text>
            </g>
          );
        })()}
        {shown.map(({ t, name, defeated, selected }) => {
          const p = drag?.id === t.id ? drag : t;
          return (
            <g key={t.id} className={"battle-token" + (selected ? " selected" : "") + (defeated ? " defeated" : "")} tabIndex={0} role="button"
              aria-label={`Token ${name}${defeated ? ", defeated" : ""}`} aria-pressed={t.combatantId ? selected : undefined}
              onClick={() => select(t)}
              data-col={p.x} data-row={p.y} transform={`translate(${p.x * CELL} ${p.y * CELL})`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(t); } else nudge(t, e); }}
              onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setDrag({ id: t.id, x: t.x, y: t.y }); }}
              onPointerMove={(e) => { if (drag?.id === t.id) { const q = square(e); if (q) setDrag({ id: t.id, ...q }); } }}
              onPointerUp={() => { if (drag?.id === t.id) { void patchToken(t.id, { x: drag.x, y: drag.y }); setDrag(null); } }}>
              <circle cx={CELL / 2} cy={CELL / 2} r={CELL / 2 - 2} fill={t.color} />
              {(() => { const l = tokenLabel(name); return <text x={CELL / 2} y={CELL / 2 + (l.length > 2 ? 5 : 6)} textAnchor="middle" className={"token-label" + (l.length > 2 ? " long" : "")}>{l}</text>; })()}
              <title>{name}</title>
              {selected && <circle cx={CELL / 2} cy={CELL / 2} r={CELL / 2 - 1} className="token-selected" fill="none" />}
              {defeated && <path d={`M${CELL * 0.25} ${CELL * 0.25} L${CELL * 0.75} ${CELL * 0.75} M${CELL * 0.75} ${CELL * 0.25} L${CELL * 0.25} ${CELL * 0.75}`} className="token-defeated-mark" />}
            </g>
          );
        })}
        {ruler && <rect x={box.x} y={box.y} width={box.w} height={box.h} className="ruler-square"
          onPointerDown={(e) => { const q = square(e); if (q) rulerDown(q); }} onPointerMove={(e) => { const q = square(e); if (q) rulerOver(q); }}
          onPointerUp={(e) => { const q = square(e); if (q) rulerEnd(q); }} />}
        {ruler && visibleSquares <= MAX_RULER_SQUARES && Array.from({ length: visibleSquares }, (_, i) => {
          const w = cols.hi - cols.lo, q = { x: cols.lo + (i % w), y: rows.lo + Math.floor(i / w) };
          return <rect key={`${q.x},${q.y}`} x={q.x * CELL} y={q.y * CELL} width={CELL} height={CELL} className="ruler-square" aria-label={`Square ${q.x},${q.y}`}
            onPointerDown={() => rulerDown(q)} onPointerEnter={() => rulerOver(q)} onPointerUp={() => rulerEnd(q)} onClick={() => rulerEnd(q)} />;
        })}
        {rule && (() => {
          const c = (n: number) => n * CELL + CELL / 2, ft = distanceFeet(rule.a, rule.b, map.feetPerSquare);
          return (
            <g className="ruler-mark" pointerEvents="none">
              <line data-testid="ruler-line" x1={c(rule.a.x)} y1={c(rule.a.y)} x2={c(rule.b.x)} y2={c(rule.b.y)} />
              <circle cx={c(rule.a.x)} cy={c(rule.a.y)} r={5} /><circle cx={c(rule.b.x)} cy={c(rule.b.y)} r={5} />
              <text x={(c(rule.a.x) + c(rule.b.x)) / 2} y={(c(rule.a.y) + c(rule.b.y)) / 2 - 8} textAnchor="middle">{ft} ft</text>
            </g>
          );
        })()}
      </svg>
      </div>
      <form className="row" aria-label="Add token" onSubmit={add}>
        <input aria-label="Token name" placeholder="Token name" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Token colour" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button type="submit" className="primary" disabled={!name.trim()}>Add token</button>
        <button type="button" onClick={() => void change((m) => withCombatantTokens(m, enc.combatants))}>Add tokens for all combatants</button>
      </form>
      {shown.length > 0 && (
        <ul className="npc-items" aria-label="Tokens">
          {shown.map(({ t, name: label }) => (
            <li key={t.id} className="row" aria-label={`Token row ${label}`}>
              <input aria-label={`Colour of ${label}`} type="color" value={t.color} onChange={(e) => void patchToken(t.id, { color: e.target.value })} />
              {t.combatantId ? <span className="grow" aria-label={`Name of ${label}`}>{label}</span> : <input aria-label={`Name of ${label}`} className="grow" defaultValue={t.name} key={t.name}
                onBlur={(e) => { const n = e.target.value.trim(); if (n && n !== t.name) void patchToken(t.id, { name: n }); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />}
              <select aria-label={`Link to combatant for ${label}`} value={t.combatantId ?? ""} onChange={(e) => relink(t, label, e.target.value)}>
                <option value="">None</option>
                {enc.combatants.filter((c) => c.kind !== "lair" && (c.id === t.combatantId || !placed.has(c.id))).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button aria-label={`Delete token ${label}`} onClick={() => void change((m) => ({ ...m, tokens: m.tokens.filter((k) => k.id !== t.id) }))}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BattleMapPanel({ campaign }: PanelProps) {
  const enc = useActiveEncounter(campaign.id);
  if (enc === undefined) return <Loading />;
  if (!enc) return <p className="muted">Start an Encounter in the Initiative panel to use the Battle Map.</p>;
  return <Grid campaignId={campaign.id} enc={enc} />;
}

export default registerPanel({ id: "battle-map", title: "Battle Map", component: BattleMapPanel });
