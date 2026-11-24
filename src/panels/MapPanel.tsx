import { useEffect, useMemo, useRef, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { Loading, EmptyState } from "../ui/PanelStates";
import {
  MAP_MAX_SQUARES, clampSquares, createMap, deleteMap, freeSquare, readLastMapId, readMapView, toStoredImage, updateMap, useMaps, withCombatantTokens, writeLastMapId, writeMapView,
  type MapLine, type MapMarker, type MapRecord, type MapToken, type MapUnit, type MapView, type StoredImage,
} from "../storage/maps";
import { useActiveEncounter } from "../storage/encounters";
import { isDefeated, type Encounter } from "../combat/rules";
import { pickCombatant, useCombatPick } from "../combat/combatSelection";
import { distanceSquares, distanceUnits, formatDistance, type Square } from "../battle/measure";
import { tokenLabel } from "../battle/tokens";
import { reachArea } from "../battle/speed";
import { useCombatantSpeed } from "../battle/useCombatantSpeed";
import { usePanelMode } from "../ui/PanelMode";
import { createLocation, selectLocation, useLocations } from "../storage/locations";
import { setPartyLocation } from "../storage/campaigns";
import { useShortcutClaim } from "../shortcuts/shortcuts";
import { routeLength } from "../map/routes";
import { partyLocationInSquare } from "../map/party";
import { scaleBar } from "../map/scale";
import { CELL, lineLabels, newLine, pointerSquare, usePxPerUnit } from "../map/lines";
import { pointInPolygon, snapToHalf, type Pt } from "../map/geometry";
import { LinesLayer, PointHandles } from "../map/LinesLayer";
import { DrawLayer } from "../map/DrawLayer";
import { LineEditor } from "../map/LineEditor";
import { AreasLayer } from "../map/AreasLayer";
import { AreaEditor } from "../map/AreaEditor";
import { areaLabel } from "../map/areas";
import { MarkersLayer } from "../map/MarkersLayer";
import { MarkerEditor } from "../map/MarkerEditor";
import { markerLabel, newMarker } from "../map/markers";
import { commitOnEnter } from "../map/fields";

type Tool = "select" | "draw" | "route" | "marker" | "ruler";
const PAN_SLOP_PX = 3; // a press that moves less than this is a click, not a pan
const MAX_LINES = 120; // more grid lines than this across the map: draw every 2nd, 4th, ... so it stays a grid, not a smear
const MAX_RULER_SQUARES = 4000; // labelled ruler squares are drawn only while this few are in view; the overlay measures the rest
const ZOOM_STEP = 1.5; // each click multiplies/divides the zoom; there is no upper or lower limit
const PARTY = "party-token"; // the drag id of the Party Token (Token ids are UUIDs)
const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad", "#7f8c8d"];

/** Object URL for a stored image, revoked when the image changes or the panel goes away. */
function useObjectUrl(img?: StoredImage): string | undefined {
  const url = useMemo(() => (img ? URL.createObjectURL(new Blob([img.data], { type: img.type })) : undefined), [img]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

/** One Map: settings, background, Tokens and the zoomable canvas. Keyed by Map id, so each Map keeps its own view.
 *  `enc` is the running Encounter when it is played on this Map: its Combatants can be linked to Tokens. */
function MapView_({ map, enc }: { map: MapRecord; enc?: Encounter }) {
  const campaignId = map.campaignId;
  const svg = useRef<SVGSVGElement>(null);
  const panning = useRef<{ x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const justPanned = useRef(false); // the click that ends a drag-pan must not select what lay under it
  // null = the fit view (zoom 1, centred), which follows the Map's size when it changes.
  const [view, setView] = useState<MapView | null>(() => readMapView(map.id));
  useEffect(() => { writeMapView(map.id, view); }, [map.id, view]);
  const change = (fn: (m: MapRecord) => MapRecord) => updateMap(map.id, fn);

  const bg = map.background;
  const bgUrl = useObjectUrl(bg?.image);
  const bgScale = bg?.scale ?? 1, bgX = bg?.offsetX ?? 0, bgY = bg?.offsetY ?? 0;
  const patchBg = (p: Partial<NonNullable<MapRecord["background"]>>) => void change((m) => ({ ...m, background: { ...m.background, ...p } }));
  const setBgNumber = (key: "scale" | "offsetX" | "offsetY", v: string) => {
    const n = Number(v);
    if (v.trim() !== "" && Number.isFinite(n) && (key !== "scale" || n > 0)) patchBg({ [key]: n });
  };
  const setSize = (key: "width" | "height", v: string) => {
    const n = Number(v);
    if (v.trim() !== "" && Number.isFinite(n) && n >= 1) void change((m) => ({ ...m, [key]: clampSquares(n) }));
  };
  const setPerSquare = (v: string) => { const n = Number(v); if (v.trim() !== "" && Number.isFinite(n) && n > 0) void change((m) => ({ ...m, perSquare: n })); };

  const W = map.width * CELL, H = map.height * CELL;
  const zoom = view?.zoom ?? 1, centre = view?.centre ?? { x: W / 2, y: H / 2 };
  const vw = W / zoom, vh = H / zoom;
  const box = { x: centre.x - vw / 2, y: centre.y - vh / 2, w: vw, h: vh };
  const stride = 2 ** Math.max(0, Math.ceil(Math.log2(Math.max(map.width, map.height) / MAX_LINES)));
  const zoomBy = (k: number) => setView({ zoom: zoom * k, centre });
  // Cmd/Ctrl + scroll wheel (and trackpad pinch, which arrives as Ctrl + wheel) zooms about the pointer: the point under it stays put.
  // A native listener, because React's wheel listener is passive and could not stop the page from zooming or scrolling.
  const wheelView = useRef({ zoom, centre });
  wheelView.current = { zoom, centre };
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.deltaY) return;
      e.preventDefault();
      const { zoom: z, centre: c } = wheelView.current;
      const k = Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.005);
      const ctm = el.getScreenCTM?.();
      const p = ctm ? new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()) : c;
      setView({ zoom: z * k, centre: { x: p.x + (c.x - p.x) / k, y: p.y + (c.y - p.y) / k } });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  // The shown grid keeps its on-screen size at every zoom; what one of its squares stands for scales with zoom
  // (zoom in: smaller). Tokens, the ruler and Routes still use the Map's own squares.
  const gridSquares = stride / zoom; // one shown grid square, in the Map's own squares
  const gridStep = CELL * gridSquares, gridPerSquare = map.perSquare * gridSquares;
  // It has no edge: lines cover whatever is in view, past the Map's size too.
  const gridAt = (from: number, to: number) => {
    const out: number[] = [];
    for (let i = Math.ceil(from / gridStep); i * gridStep <= to + 1e-6; i++) out.push(i * gridStep);
    return out;
  };
  // The grid carries on past the Map's size for the ruler: its squares cover whatever is in view.
  const cols = { lo: Math.floor(box.x / CELL), hi: Math.ceil((box.x + box.w) / CELL) };
  const rows = { lo: Math.floor(box.y / CELL), hi: Math.ceil((box.y + box.h) / CELL) };
  const visibleSquares = (cols.hi - cols.lo) * (rows.hi - rows.lo);

  // Pan: press on empty map or on an Area fill and drag. A press that does not move is a click (deselects on empty map, selects the Area).
  const panStart = (e: React.PointerEvent) => {
    justPanned.current = false;
    panning.current = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const panMove = (e: React.PointerEvent) => {
    const last = panning.current, el = svg.current;
    if (!last || !el) return;
    if (!last.moved && Math.hypot(e.clientX - last.sx, e.clientY - last.sy) < PAN_SLOP_PX) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(box.w / (r.width || box.w), box.h / (r.height || box.h)); // letterboxed: the tighter side sets the scale
    setView({ zoom, centre: { x: centre.x - (e.clientX - last.x) * k, y: centre.y - (e.clientY - last.y) * k } });
    panning.current = { ...last, x: e.clientX, y: e.clientY, moved: true };
  };
  /** Ends a pan; true when the pointer moved (so the release is not a click). */
  const panEnd = () => { const moved = !!panning.current?.moved; panning.current = null; justPanned.current = moved; return moved; };

  // Tokens. A linked Token is its Combatant: the name comes from there, defeat marks or hides it.
  const pick = useCombatPick(campaignId);
  const selectedId = enc && pick && pick.activeId === enc.activeId ? pick.combatantId : undefined; // lapses when the turn moves, like the Stat Block panel
  const shown = map.tokens.flatMap((t) => {
    const c = enc && t.combatantId ? enc.combatants.find((x) => x.id === t.combatantId) : undefined;
    if (!c) return [{ t, name: t.name, defeated: false, selected: false, linked: false }];
    if (isDefeated(c) && enc!.defeatMode === "remove") return [];
    return [{ t, name: c.name, defeated: isDefeated(c), selected: c.id === selectedId, linked: true }];
  });
  // Speed ring: only the selected Token, drawn from where it stands (it stays put while dragging, so the drop can be judged). Needs a Map in feet.
  const selectedToken = shown.find((x) => x.selected && !x.defeated)?.t;
  const speedFeet = useCombatantSpeed(campaignId, enc?.combatants.find((c) => c.id === selectedToken?.combatantId));
  const [selToken, setSelToken] = useState<string | null>(null); // any Token (linked or free), for Delete/Backspace
  const select = (t: MapToken) => {
    setSelToken(t.id); setSelLine(null); setSelMarker(null);
    if (enc && t.combatantId) pickCombatant(campaignId, { combatantId: t.combatantId, activeId: enc.activeId });
  };
  const patchToken = (id: string, p: Partial<MapToken>) => change((m) => ({ ...m, tokens: m.tokens.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const addToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void change((m) => ({ ...m, tokens: [...m.tokens, { id: crypto.randomUUID(), name: name.trim(), color, ...freeSquare(m) }] }));
    setName("");
  };
  const placed = new Set(map.tokens.map((t) => t.combatantId));
  /** Link a Token to a Combatant (it then follows that name), or unlink it (it keeps the name it showed as its own). */
  const relink = (t: MapToken, current: string, combatantId: string) => {
    const c = enc?.combatants.find((x) => x.id === combatantId);
    void patchToken(t.id, c ? { combatantId: c.id, name: c.name } : { combatantId: undefined, name: current });
  };
  const nudge = (t: MapToken, e: React.KeyboardEvent) => {
    const d = KEYS[e.key];
    if (!d) return;
    e.preventDefault();
    void change((m) => ({ ...m, tokens: m.tokens.map((k) => (k.id === t.id ? { ...k, x: k.x + d[0], y: k.y + d[1] } : k)) })); // deltas, so key repeats never lose a step
  };
  // Party Token: one per Map, in the Token layer. Arriving on a linked Marker or Area (after a drop or an arrow step) sets the party location; leaving it elsewhere or removing it changes nothing.
  const arrive = (at: Square) => {
    const loc = partyLocationInSquare(map, at);
    if (loc) void setPartyLocation(campaignId, loc);
  };
  const moveParty = async (to: (cur: Square) => Square) => {
    let at: Square | undefined;
    await change((m) => { if (!m.partyToken) return m; at = to(m.partyToken); return { ...m, partyToken: at }; }); // from the stored square, so key repeats never lose a step
    if (at) arrive(at);
  };
  const nudgeParty = (e: React.KeyboardEvent) => {
    const d = KEYS[e.key];
    if (!d) return;
    e.preventDefault();
    void moveParty((c) => ({ x: c.x + d[0], y: c.y + d[1] }));
  };
  // Pointer to square through the SVG's own transform: the canvas is letterboxed, so the element box is not the drawing's box.
  const square = (e: React.PointerEvent): Square | null => {
    const el = svg.current, ctm = el?.getScreenCTM?.();
    if (!el || !ctm) return null;
    const pt = el.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: Math.floor(p.x / CELL), y: Math.floor(p.y / CELL) }; // snaps to squares, grid shown or not
  };
  // Ruler: transient, never saved, measures in the Map's unit. `locked` = the end is chosen. Ends are points in squares that snap to the
  // nearest centre, corner or edge midpoint of the shown grid's squares; without pointer geometry (jsdom) a square's own target gives its centre.
  const [tool, setTool] = useState<Tool>("select");
  const ruler = tool === "ruler";
  const [rule, setRule] = useState<{ a: Pt; b: Pt; locked: boolean } | null>(null);
  const rulerAt = (e: { clientX: number; clientY: number }, q?: Square): Pt | null => {
    const p = freePoint(e);
    return p ? snapToHalf(p, gridSquares) : q ? { x: q.x + 0.5, y: q.y + 0.5 } : null;
  };
  const same = (p: Pt, q: Pt) => p.x === q.x && p.y === q.y;
  // Click start then end, or press at one point and release at another.
  const rulerDown = (q: Pt | null) => { if (q && (!rule || rule.locked)) setRule({ a: q, b: q, locked: false }); };
  const rulerOver = (q: Pt | null) => { if (q && rule && !rule.locked && !same(q, rule.b)) setRule({ ...rule, b: q }); };
  const rulerEnd = (q: Pt | null) => { if (q && rule && !rule.locked && !same(q, rule.a)) setRule({ ...rule, b: q, locked: true }); };
  const pickTool = (t: Tool) => { setTool((cur) => (cur === t && t !== "select" ? "select" : t)); setRule(null); setDraft([]); setSelLine(null); setSelMarker(null); setSelToken(null); };
  const measured = rule && formatDistance(distanceUnits(rule.a, rule.b, map.perSquare), map.unit);

  // Lines and Shapes: drawn with the Draw tool, selected with Select. `draft` is the Line being drawn (not saved until finished).
  const labels = lineLabels(map.lines);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [selLine, setSelLine] = useState<string | null>(null);
  const [selSeg, setSelSeg] = useState<number | null>(null);
  // Drags in progress, shown live and saved on release: one point of a Line (`moved`) or a whole Area (`shift`).
  const [moved, setMoved] = useState<{ id: string; index: number; at: Pt } | null>(null);
  const [shift, setShift] = useState<{ id: string; by: Pt } | null>(null);
  const live = (l: MapLine): MapLine => moved?.id === l.id ? { ...l, points: l.points.map((p, i) => (i === moved.index ? moved.at : p)) }
    : shift?.id === l.id ? { ...l, points: l.points.map((p) => ({ x: p.x + shift.by.x, y: p.y + shift.by.y })) } : l;
  const liveLines = map.lines.map(live);
  const selected = map.lines.find((l) => l.id === selLine);
  const [selMarker, setSelMarker] = useState<string | null>(null);
  const marker = map.markers.find((k) => k.id === selMarker);
  const locations = useLocations(campaignId) ?? [];
  const areaText = (a: NonNullable<MapLine["area"]>) => areaLabel(a, locations.find((l) => l.id === a.locationId)?.name);
  // Selecting a Shape that is an Area linked to a Location selects that Location too, so the Locations panel follows.
  const pickLine = (id: string) => {
    if (id !== selLine) setSelSeg(null);
    setSelLine(id); setSelMarker(null); setSelToken(null);
    const loc = map.lines.find((l) => l.id === id)?.area?.locationId;
    if (loc) selectLocation(campaignId, loc);
  };
  const pickArea = (id: string) => { if (justPanned.current) justPanned.current = false; else pickLine(id); }; // the click ending a drag-pan selects nothing
  // Markers: placed freely (unsnapped) with the Marker tool, dragged and selected with Select or Marker. A linked one shows its Location's live name.
  const markerText = (k: MapMarker) => markerLabel(k, locations.find((l) => l.id === k.locationId)?.name);
  const freePoint = (e: { clientX: number; clientY: number }) => pointerSquare(svg.current, e, false);
  const patchMarker = (id: string, fn: (k: MapMarker) => MapMarker) => change((m) => ({ ...m, markers: m.markers.map((k) => (k.id === id ? fn(k) : k)) }));
  const pickMarker = (id: string) => {
    setSelMarker(id); setSelLine(null); setSelToken(null);
    const loc = map.markers.find((k) => k.id === id)?.locationId;
    if (loc) selectLocation(campaignId, loc);
  };
  const placeMarker = (at: Pt) => {
    const k = newMarker(at, map.markers);
    setSelMarker(k.id); setSelLine(null); setSelToken(null);
    void change((m) => ({ ...m, markers: [...m.markers, k] }));
  };
  const pxPerSquare = usePxPerUnit(svg, box.w, box.h) * CELL;
  const bar = scaleBar(pxPerSquare / map.perSquare);
  // Drawing snaps to the grid as shown (its squares change with zoom), so points land on the lines the DM sees.
  const svgPoint = (e: { clientX: number; clientY: number }) => pointerSquare(svg.current, e, map.showGrid && gridSquares);
  const drawing = (tool === "draw" || tool === "route") && draft.length > 0;
  const finishLine = (closed: boolean) => {
    const points = draft, route = tool === "route";
    setDraft([]);
    if (points.length >= (closed ? 3 : 2)) void change((m) => ({ ...m, lines: [...m.lines, newLine(points, closed, route)] }));
  };
  const patchLine = (id: string, fn: (l: MapLine) => MapLine) => change((m) => ({ ...m, lines: m.lines.map((l) => (l.id === id ? fn(l) : l)) }));
  const tokenSel = map.tokens.find((t) => t.id === selToken);
  const deleteSelected = () => {
    if (tokenSel && !marker && !selected) { setSelToken(null); void change((m) => ({ ...m, tokens: m.tokens.filter((k) => k.id !== tokenSel.id) })); }
    else if (marker) { setSelMarker(null); void change((m) => ({ ...m, markers: m.markers.filter((k) => k.id !== marker.id) })); }
    else if (selected) { setSelLine(null); void change((m) => ({ ...m, lines: m.lines.filter((l) => l.id !== selected.id) })); }
  };
  // Esc cancels the Line being drawn (instead of leaving for the Dashboard); Enter finishes it; Delete/Backspace remove the selection.
  // "+" zooms in and "-" zooms out (claims, so a second Map panel never conflicts; ignored while typing like every shortcut).
  useShortcutClaim("Plus", true, () => zoomBy(ZOOM_STEP));
  useShortcutClaim("Minus", true, () => zoomBy(1 / ZOOM_STEP));
  // Esc steps back inside the Map before it ever leaves for the Dashboard: cancel the Line being drawn, else drop the selection,
  // else go back to the Select tool. Only with Select and nothing in progress does Esc reach the Dashboard.
  const escapable = drawing || tool !== "select" || !!selLine || !!selMarker || !!selToken;
  useShortcutClaim("Escape", escapable, () => {
    if (drawing) setDraft([]);
    else if (selLine || selMarker || selToken) { setSelLine(null); setSelMarker(null); setSelToken(null); setSelSeg(null); }
    else pickTool("select");
  });
  useShortcutClaim("Enter", drawing, () => (draft.length >= 2 ? finishLine(false) : setDraft([])));
  const deletable = (!!selected || !!marker || !!tokenSel) && (tool === "select" || (tool === "marker" && !!marker));
  useShortcutClaim("Delete", deletable, deleteSelected);
  useShortcutClaim("Backspace", deletable, deleteSelected);

  return (
    <div className="map-view">
      <div className="row map-toolbar" role="toolbar" aria-label="Map tools">
        <button aria-pressed={tool === "select"} onClick={() => pickTool("select")}>Select</button>
        <button aria-pressed={tool === "draw"} onClick={() => pickTool("draw")}>Draw</button>
        <button aria-pressed={tool === "route"} onClick={() => pickTool("route")}>Route</button>
        <button aria-pressed={tool === "marker"} onClick={() => pickTool("marker")}>Marker</button>
        <button aria-pressed={ruler} onClick={() => pickTool("ruler")}>Ruler</button>
        <span className="row zoom-ctl" role="group" aria-label="Zoom">
          <button aria-label="Zoom out" title="Zoom out (-)" onClick={() => zoomBy(1 / ZOOM_STEP)}>−</button>
          <span className="muted" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom in" title="Zoom in (+)" onClick={() => zoomBy(ZOOM_STEP)}>+</button>
          <button aria-pressed={view === null} onClick={() => setView(null)} title="Show the whole map">Fit</button>
          {map.showGrid && <span className="muted" aria-label="Grid scale" title="What one grid square stands for at this zoom">1 square = {formatDistance(gridPerSquare, map.unit)}</span>}
        </span>
        {rule && <button onClick={() => setRule(null)}>Clear measurement</button>}
      </div>
      {/* Always one line tall, so the canvas never shifts while drawing or measuring (a shift moves the next click). */}
      <div className="map-status">
        {drawing && <span className="muted" role="status" aria-label="Drawing" title="Enter or double-click to finish, Esc to cancel">Drawing {draft.length} {draft.length === 1 ? "point" : "points"}: {tool === "route" ? "" : "click the first point to close, "}Enter or double-click to finish, Esc to cancel</span>}
        {rule && <span role="status" aria-label="Measured distance">{+(distanceSquares(rule.a, rule.b) / gridSquares).toFixed(2)} squares, {measured}</span>}
      </div>
      <details className="map-settings">
        <summary>Map settings <span className="muted" aria-label="Map summary">{map.width} × {map.height} squares, {map.perSquare} {map.unit} per square</span></summary>
        <div className="row">
          <label>Width <input aria-label="Map width" type="number" min={1} max={MAP_MAX_SQUARES} defaultValue={map.width} key={`w${map.width}`} onKeyDown={commitOnEnter} onBlur={(e) => setSize("width", e.target.value)} /></label>
          <label>Height <input aria-label="Map height" type="number" min={1} max={MAP_MAX_SQUARES} defaultValue={map.height} key={`h${map.height}`} onKeyDown={commitOnEnter} onBlur={(e) => setSize("height", e.target.value)} /></label>
          <label>1 square = <input aria-label="Scale per square" type="number" min={0} step="any" defaultValue={map.perSquare} key={`p${map.perSquare}`} onKeyDown={commitOnEnter} onBlur={(e) => setPerSquare(e.target.value)} /></label>
          <select aria-label="Scale unit" value={map.unit} onChange={(e) => { const unit = e.target.value as MapUnit; void change((m) => ({ ...m, unit })); }}>
            <option value="ft">feet</option>
            <option value="mi">miles</option>
          </select>
          <label><input aria-label="Show grid" type="checkbox" checked={map.showGrid} onChange={(e) => { const showGrid = e.target.checked; void change((m) => ({ ...m, showGrid })); }} /> Show grid</label>
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
      <div className="map-scroll fit">
        <svg ref={svg} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className={"map-canvas" + (bgUrl ? " has-bg" : "")} role="group" aria-label="Map canvas" style={{ "--ui": CELL / pxPerSquare } as React.CSSProperties}>
          {/* Drag the background to pan. */}
          <rect x={box.x} y={box.y} width={box.w} height={box.h} className="map-bg" data-testid="map-pan"
            onPointerDown={panStart} onPointerMove={panMove} onPointerUp={() => { if (!panEnd()) { setSelLine(null); setSelMarker(null); setSelToken(null); } }} />
          {bgUrl && <image href={bgUrl} x={bgX * CELL} y={bgY * CELL} width={W * bgScale} height={H * bgScale} preserveAspectRatio="xMinYMin meet" pointerEvents="none" aria-hidden="true" />}
          {map.showGrid && gridAt(box.x, box.x + box.w).map((x) => <line key={`v${x}`} x1={x} y1={box.y} x2={x} y2={box.y + box.h} className="grid-line" pointerEvents="none" />)}
          {map.showGrid && gridAt(box.y, box.y + box.h).map((y) => <line key={`h${y}`} x1={box.x} y1={y} x2={box.x + box.w} y2={y} className="grid-line" pointerEvents="none" />)}
          <AreasLayer lines={liveLines} labelOf={areaText} selectedId={selected?.id} selectable={tool === "select"} onSelect={pickArea} snap={map.showGrid && gridSquares}
            fits={(l) => l.points.every((p) => p.x * CELL >= box.x && p.x * CELL <= box.x + box.w && p.y * CELL >= box.y && p.y * CELL <= box.y + box.h)}
            covers={(l) => [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].every(([x, y]) => pointInPolygon({ x: x / CELL, y: y / CELL }, l.points))}
            onShift={(id, by) => setShift({ id, by })}
            onShiftEnd={(id, by) => { if (!by) { setShift(null); return; } void patchLine(id, (l) => ({ ...l, points: l.points.map((p) => ({ x: p.x + by.x, y: p.y + by.y })) })).then(() => setShift(null)); }}
            pointAt={freePoint} onPanStart={panStart} onPanMove={panMove} onPanEnd={panEnd} />
          <LinesLayer lines={liveLines} labels={labels} selectedId={selected?.id} selectable={tool === "select"} onSelect={pickLine}
            selectedSegment={selSeg} onSegment={setSelSeg} perSquare={map.perSquare} unit={map.unit} />
          {/* Under the Markers, so in the Marker tool a press on a Marker drags it rather than placing a new one. */}
          {tool === "marker" && <rect x={box.x} y={box.y} width={box.w} height={box.h} className="map-draw-surface" data-testid="map-marker-surface"
            onClick={(e) => { const p = freePoint(e); if (p) placeMarker(p); }} />}
          <MarkersLayer markers={map.markers} labelOf={markerText} selectedId={marker?.id} selectable={tool === "select" || tool === "marker"} svgPoint={freePoint}
            onSelect={pickMarker} onDrop={(id, at) => void patchMarker(id, (k) => ({ ...k, x: at.x, y: at.y }))} />
          {selectedToken && speedFeet !== null && map.unit === "ft" && (() => {
            const r = reachArea(selectedToken, speedFeet, map.perSquare, map);
            return (
              <g className="speed-ring" data-testid="speed-ring" pointerEvents="none" aria-label={`Speed ${speedFeet} ft, ${r.squares} squares`}>
                <rect x={r.x * CELL + 2} y={r.y * CELL + 2} width={r.w * CELL - 4} height={r.h * CELL - 4} rx={CELL / 2} />
                <text x={r.x * CELL + 10} y={r.y * CELL + 22}>{speedFeet} ft</text>
              </g>
            );
          })()}
          {shown.map(({ t, name: label, defeated, selected, linked }) => {
            const p = drag?.id === t.id ? drag : t;
            const short = tokenLabel(label);
            return (
              <g key={t.id} className={"map-token" + (selected || t.id === selToken ? " selected" : "") + (defeated ? " defeated" : "")} tabIndex={0} role="button"
                aria-label={`Token ${label}${defeated ? ", defeated" : ""}`} aria-pressed={linked ? selected : undefined}
                onClick={() => select(t)}
                data-col={p.x} data-row={p.y} transform={`translate(${(p.x + 0.5) * CELL} ${(p.y + 0.5) * CELL})`}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(t); } else nudge(t, e); }}
                onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setDrag({ id: t.id, x: t.x, y: t.y }); }}
                onPointerMove={(e) => { if (drag?.id === t.id) { const q = square(e); if (q) setDrag({ id: t.id, ...q }); } }}
                onPointerUp={() => { if (drag?.id === t.id) { void patchToken(t.id, { x: drag.x, y: drag.y }); setDrag(null); } }}>
                <circle cx={CELL / 2} cy={CELL / 2} r={CELL / 2 - 2} fill={t.color} />
                <text x={CELL / 2} y={CELL / 2 + (short.length > 2 ? 5 : 6)} textAnchor="middle" className={"token-label" + (short.length > 2 ? " long" : "")}>{short}</text>
                <title>{label}</title>
                {(selected || t.id === selToken) && <circle cx={CELL / 2} cy={CELL / 2} r={CELL / 2 - 1} className="token-selected" fill="none" />}
                {defeated && <path d={`M${CELL * 0.25} ${CELL * 0.25} L${CELL * 0.75} ${CELL * 0.75} M${CELL * 0.75} ${CELL * 0.25} L${CELL * 0.25} ${CELL * 0.75}`} className="token-defeated-mark" />}
              </g>
            );
          })}
          {map.partyToken && (() => {
            const p = drag?.id === PARTY ? drag : map.partyToken;
            return (
              <g className="map-token party-token" tabIndex={0} role="button" aria-label="Party token"
                data-col={p.x} data-row={p.y} transform={`translate(${(p.x + 0.5) * CELL} ${(p.y + 0.5) * CELL})`}
                onKeyDown={nudgeParty}
                onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setDrag({ id: PARTY, ...map.partyToken! }); }}
                onPointerMove={(e) => { if (drag?.id === PARTY) { const q = square(e); if (q) setDrag({ id: PARTY, ...q }); } }}
                onPointerUp={() => { if (drag?.id === PARTY) { const to = { x: drag.x, y: drag.y }; setDrag(null); void moveParty(() => to); } }}>
                {/* A fixed on-screen size at every zoom, like Markers (--ui counter-scales), centred on its square. */}
                <g style={{ transform: "scale(var(--ui))" }}>
                  <circle r={11} fill="#f1c40f" />
                  <circle r={12} className="party-ring" fill="none" />
                  <text y={5} textAnchor="middle" className="party-star">★</text>
                </g>
                <title>Party</title>
              </g>
            );
          })()}
          {(tool === "draw" || tool === "route") && <DrawLayer box={box} points={draft} pxPerSquare={pxPerSquare} svgPoint={svgPoint} route={tool === "route"}
            onAdd={(p) => setDraft((d) => [...d, p])} onClose={() => finishLine(true)} onFinish={() => finishLine(false)} onCancel={() => setDraft([])} />}
          {ruler && <rect x={box.x} y={box.y} width={box.w} height={box.h} className="ruler-square"
            onPointerDown={(e) => rulerDown(rulerAt(e))} onPointerMove={(e) => rulerOver(rulerAt(e))} onPointerUp={(e) => rulerEnd(rulerAt(e))} />}
          {ruler && visibleSquares <= MAX_RULER_SQUARES && Array.from({ length: visibleSquares }, (_, i) => {
            const w = cols.hi - cols.lo, q = { x: cols.lo + (i % w), y: rows.lo + Math.floor(i / w) };
            return <rect key={`${q.x},${q.y}`} x={q.x * CELL} y={q.y * CELL} width={CELL} height={CELL} className="ruler-square" aria-label={`Square ${q.x},${q.y}`}
              onPointerDown={(e) => rulerDown(rulerAt(e, q))} onPointerMove={(e) => rulerOver(rulerAt(e, q))} onPointerEnter={(e) => rulerOver(rulerAt(e, q))}
              onPointerUp={(e) => rulerEnd(rulerAt(e, q))} onClick={(e) => rulerEnd(rulerAt(e, q))} />;
          })}
          {rule && (() => {
            const c = (n: number) => n * CELL;
            return (
              <g className="ruler-mark" pointerEvents="none">
                <line data-testid="ruler-line" x1={c(rule.a.x)} y1={c(rule.a.y)} x2={c(rule.b.x)} y2={c(rule.b.y)} />
                <circle cx={c(rule.a.x)} cy={c(rule.a.y)} r={5} /><circle cx={c(rule.b.x)} cy={c(rule.b.y)} r={5} />
                <text x={(c(rule.a.x) + c(rule.b.x)) / 2} y={(c(rule.a.y) + c(rule.b.y)) / 2 - 8} textAnchor="middle">{measured}</text>
              </g>
            );
          })()}
          {tool === "select" && selected && <PointHandles line={live(selected)} label={labels.get(selected.id)!} svgPoint={svgPoint}
            onMove={(index, at) => setMoved({ id: selected.id, index, at })}
            onDrop={(index, at) => { setMoved(null); void patchLine(selected.id, (l) => ({ ...l, points: l.points.map((p, i) => (i === index ? at : p)) })); }} />}
        </svg>
        {bar && (
          <div className="map-scale" role="img" aria-label={`Scale bar ${formatDistance(bar.amount, map.unit)}`}>
            <span className="map-scale-bar" style={{ width: bar.px }} />
            <span>{formatDistance(bar.amount, map.unit)}</span>
          </div>
        )}
      </div>
      {tool === "select" && selected && <LineEditor line={selected} label={labels.get(selected.id)!} length={routeLength(live(selected).points, map.perSquare, map.unit)} onDelete={deleteSelected}
        segment={selSeg} onSegment={setSelSeg}
        onKind={(i, kind) => void patchLine(selected.id, (l) => ({ ...l, segments: l.segments.map((k, j) => (i === null || j === i ? kind : k)) }))} />}
      {marker && (tool === "select" || tool === "marker") && <MarkerEditor marker={marker} label={markerText(marker)} locations={locations}
        onChange={(fn) => void patchMarker(marker.id, fn)} onDelete={deleteSelected}
        onCreateLocation={() => void createLocation(campaignId, { name: marker.name.trim() || "Marker", notes: "" }).then((loc) => {
          selectLocation(campaignId, loc.id);
          return patchMarker(marker.id, (k) => ({ ...k, locationId: loc.id }));
        })} />}
      {tool === "select" && selected?.closed && !selected.route && <AreaEditor label={labels.get(selected.id)!} area={selected.area} locations={locations}
        onChange={(change) => void patchLine(selected.id, ({ area: old, ...l }) => { const area = change(old); return area ? { ...l, area } : l; })}
        onCreateLocation={() => {
          const a = selected.area;
          if (!a) return;
          void createLocation(campaignId, { name: a.name?.trim() || a.kind, notes: "" }).then((loc) => {
            selectLocation(campaignId, loc.id);
            return patchLine(selected.id, (l) => (l.area ? { ...l, area: { ...l.area, locationId: loc.id } } : l));
          });
        }} />}
      <form className="row" aria-label="Add token" onSubmit={addToken}>
        <input aria-label="Token name" placeholder="Token name" value={name} onChange={(e) => setName(e.target.value)} />
        <input aria-label="Token colour" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button type="submit" className="primary" disabled={!name.trim()}>Add token</button>
        {!map.partyToken && <button type="button" onClick={() => void change((m) => ({ ...m, partyToken: freeSquare(m) }))}>Add party token</button>}
        {enc && <button type="button" onClick={() => void change((m) => withCombatantTokens(m, enc.combatants))}>Add tokens for all combatants</button>}
      </form>
      {map.partyToken && (
        <div className="row" aria-label="Party token row">
          <span className="grow">★ Party token</span>
          <button onClick={() => void change(({ partyToken: _gone, ...m }) => m as MapRecord)}>Remove party token</button>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="npc-items" aria-label="Tokens">
          {shown.map(({ t, name: label, linked }) => (
            <li key={t.id} className="row" aria-label={`Token row ${label}`}>
              <input aria-label={`Colour of ${label}`} type="color" value={t.color} onChange={(e) => void patchToken(t.id, { color: e.target.value })} />
              {linked ? <span className="grow" aria-label={`Name of ${label}`}>{label}</span> : <input aria-label={`Name of ${label}`} className="grow" defaultValue={t.name} key={t.name}
                onBlur={(e) => { const n = e.target.value.trim(); if (n && n !== t.name) void patchToken(t.id, { name: n }); }}
                onKeyDown={commitOnEnter} />}
              {enc && (
                <select aria-label={`Link to combatant for ${label}`} value={linked ? t.combatantId : ""} onChange={(e) => relink(t, label, e.target.value)}>
                  <option value="">None</option>
                  {enc.combatants.filter((c) => c.kind !== "lair" && (c.id === t.combatantId || !placed.has(c.id))).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <button aria-label={`Delete token ${label}`} onClick={() => void change((m) => ({ ...m, tokens: m.tokens.filter((k) => k.id !== t.id) }))}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MapPanel({ campaign }: PanelProps) {
  const maps = useMaps(campaign.id);
  const enc = useActiveEncounter(campaign.id);
  const mode = usePanelMode();
  const [chosen, setChosen] = useState<string | null>(() => readLastMapId(campaign.id));
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // In Combat with an Encounter running, the panel shows the Encounter's Map and the picker is locked to it
  // (switching would hide the fight; the Encounter's Map is chosen when it starts).
  const encMap = enc?.mapId ? maps?.find((m) => m.id === enc.mapId) : undefined;
  const locked = mode === "combat" && !!encMap;
  const current = (locked ? encMap : undefined) ?? maps?.find((m) => m.id === chosen) ?? maps?.[0];
  const inUse = !!current && enc?.mapId === current.id; // the running Encounter stands on it
  const currentId = current?.id;
  useEffect(() => { if (currentId) writeLastMapId(campaign.id, currentId); }, [campaign.id, currentId]);
  useEffect(() => { setRenaming(false); setConfirming(false); }, [currentId]);

  if (!maps) return <Loading />;
  const add = () => void createMap(campaign.id).then((m) => setChosen(m.id));
  if (!current) return <EmptyState action={<button className="primary" onClick={add}>New map</button>}>No maps yet. Make one to start drawing.</EmptyState>;

  const rename = (v: string) => {
    setRenaming(false);
    const name = v.trim();
    if (name && name !== current.name) void updateMap(current.id, (m) => ({ ...m, name }));
  };
  const remove = () => {
    setConfirming(false);
    writeMapView(current.id, null);
    void deleteMap(current.id);
  };

  return (
    <div className="map-panel">
      <div className="row">
        {renaming ? (
          <input aria-label="Map name" autoFocus defaultValue={current.name}
            onBlur={(e) => rename(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); else if (e.key === "Escape") { e.stopPropagation(); setRenaming(false); } }} />
        ) : (
          <select aria-label="Map" value={current.id} disabled={locked} title={locked ? "The running Encounter's Map" : undefined} onChange={(e) => setChosen(e.target.value)}>
            {maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <button onClick={add} disabled={locked}>New map</button>
        <button onClick={() => { setConfirming(false); setRenaming(true); }} disabled={renaming}>Rename</button>
        {confirming ? (
          <>
            <button className="danger" onClick={remove}>Yes, delete it</button>
            <button onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : <button onClick={() => setConfirming(true)} disabled={inUse} title={inUse ? "The running Encounter is played on this Map" : undefined}>Delete map</button>}
      </div>
      <MapView_ key={current.id} map={current} enc={inUse ? enc! : undefined} />
    </div>
  );
}

export default registerPanel({ id: "map", title: "Map", component: MapPanel });
