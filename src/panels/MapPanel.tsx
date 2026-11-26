import { useEffect, useRef, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { Loading, EmptyState } from "../ui/PanelStates";
import {
  createMap, deleteMap, freeSquare, readLastMapId, onMapViewWrite, readMapView, updateMap, useMaps, withCombatantTokens, writeLastMapId, writeMapView,
  type MapLine, type MapMarker, type MapRecord, type MapToken, type MapView,
} from "../storage/maps";
import { useActiveEncounter } from "../storage/encounters";
import { isDefeated, type Encounter } from "../combat/rules";
import { pickCombatant, useCombatPick } from "../combat/combatSelection";
import { distanceSquares, formatDistance, type Square } from "../battle/measure";
import { tokenLabel } from "../battle/tokens";
import { reachArea } from "../battle/speed";
import { useCombatantSpeed } from "../battle/useCombatantSpeed";
import { usePanelMode } from "../ui/PanelMode";
import { createLocation, selectLocation, useLocations } from "../storage/locations";
import { setPartyLocation } from "../storage/campaigns";
import { useShortcutClaim } from "../shortcuts/shortcuts";
import { routeLength } from "../map/routes";
import { ScreenSized } from "../map/ScreenSized";
import { partyLocationAt, partyLocationInSquare } from "../map/party";
import { BATTLE_PX_PER_SQUARE, battleView, FEET_PER_MILE, FEET_PER_SQUARE, MILES_FROM_FEET, clampPxPerSquare, fitView, formatSquares, gridLadder, mapBounds } from "../map/scale";
import { CELL, lineLabels, newLine, pointerSquare, segmentsOf, splitSegment, unitsPerSquare, useCanvasSize } from "../map/lines";
import { TOKEN_MIN_PX, boundsIntersect, markerOpacity, boundsOf, fadeBySize, pointInPolygon, projectOnSegment, snapToHalf, snapToStep, type Pt } from "../map/geometry";
import { anchorFor, toLocal, toWorld } from "../map/anchor";
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
import { findTargets, findView, lineBounds, lineCentre, type FindTarget } from "../map/find";

type Tool = "select" | "draw" | "route" | "marker" | "ruler";
const PAN_SLOP_PX = 3; // a press that moves less than this is a click, not a pan
const MAX_RULER_SQUARES = 4000; // labelled ruler squares are drawn only while this few are in view; the overlay measures the rest
/** Zoom as a multiplier of battle scale: 0.5x, 1.43x, 100x. */
export const formatZoom = (pxPerSquare: number) => `${+(pxPerSquare / BATTLE_PX_PER_SQUARE).toPrecision(3)}x`;
const ZOOM_STEP = 1.5; // each click multiplies/divides the zoom
const ZOOM_MS = 150; // how long a +/- step takes
/** Animate +/- only where frames are timed and motion is allowed. jsdom has no matchMedia, so tests get the instant path. */
const canAnimate = () => typeof window.matchMedia === "function" && typeof requestAnimationFrame === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The Party Token is never drawn smaller than this on screen (px across), however far out the view is. */
export const PARTY_MIN_PX = 14;
const PARTY = "party-token"; // the drag id of the Party Token (Token ids are UUIDs)
const KEYS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f39c12", "#8e44ad", "#7f8c8d"];

/** One Map: settings, Tokens and the endless zoomable canvas. Keyed by Map id, so each Map keeps its own view.
 *  `enc` is the running Encounter when it is played on this Map: its Combatants can be linked to Tokens. */
function MapView_({ map, enc }: { map: MapRecord; enc?: Encounter }) {
  const campaignId = map.campaignId;
  const svg = useRef<SVGSVGElement>(null);
  const panning = useRef<{ x: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const justPanned = useRef(false); // the click that ends a drag-pan must not select what lay under it
  // The view is where the DM is looking: centre in squares, on-screen pixels per square. A new Map opens at battle scale at (0, 0).
  const [view, setViewRaw] = useState<MapView>(() => readMapView(map.id) ?? (enc?.spot ? { centre: enc.spot, pxPerSquare: BATTLE_PX_PER_SQUARE } : battleView()));
  const anim = useRef<{ id: number; to: number; timer?: number } | null>(null); // a running +/- zoom animation and the zoom it is heading for
  const stopAnim = () => { if (anim.current) { cancelAnimationFrame(anim.current.id); clearTimeout(anim.current.timer); } anim.current = null; };
  useEffect(() => stopAnim, []);
  const setView = (v: MapView) => { stopAnim(); setViewRaw({ centre: v.centre, pxPerSquare: clampPxPerSquare(v.pxPerSquare) }); };
  useEffect(() => { writeMapView(map.id, view); }, [map.id, view]);
  // A view written from outside (starting an Encounter zoomed out sets battle scale at its spot) is adopted; our own writes are equal and change nothing.
  useEffect(() => onMapViewWrite((id, v) => {
    if (id === map.id) setViewRaw((p) => (p.pxPerSquare === v.pxPerSquare && p.centre.x === v.centre.x && p.centre.y === v.centre.y ? p : v));
  }), [map.id]);
  const change = (fn: (m: MapRecord) => MapRecord) => updateMap(map.id, fn);

  const size = useCanvasSize(svg);
  const { centre, pxPerSquare } = view;
  const livePx = useRef(pxPerSquare);
  livePx.current = anim.current ? livePx.current : pxPerSquare; // mid-animation the frames own it
  // The SVG draws in U units per square (CELL, or fewer when zoomed far out: see unitsPerSquare); its viewBox is exactly the canvas at this
  // zoom, so the Map has no edge.
  const U = unitsPerSquare(pxPerSquare);
  const vw = size.w / pxPerSquare, vh = size.h / pxPerSquare;
  // Precision: everything is drawn relative to an anchor near the view centre (squares from the anchor, never the huge world numbers), so the
  // browser's single-precision transforms stay exact however far from (0, 0) the view is. Stored data stays absolute; `L` and `W` convert.
  const A = anchorFor(centre, pxPerSquare, size.w);
  const anchorRef = useRef(A);
  anchorRef.current = A;
  const L = (p: Pt) => toLocal(p, A), W = (p: Pt) => toWorld(p, A);
  const box = { x: (centre.x - A.x - vw / 2) * U, y: (centre.y - A.y - vh / 2) * U, w: vw * U, h: vh * U };
  // Zoom is continuous (no snapping). Keeps `anchor` (a point in squares; default the centre) where it is on screen.
  const zoomTo = (px: number, from: MapView, anchor: Pt = from.centre) => {
    const next = clampPxPerSquare(px), k = next / from.pxPerSquare;
    setView({ pxPerSquare: next, centre: { x: anchor.x + (from.centre.x - anchor.x) / k, y: anchor.y + (from.centre.y - anchor.y) / k } });
  };
  // The +/- buttons and keys: a fixed step, eased over ZOOM_MS about the centre; instant when motion is reduced or frames can't be timed.
  // `livePx` is the zoom on screen right now (a frame may have moved it since this closure's render), so a step always starts from it.
  const zoomBy = (k: number) => {
    const px0 = livePx.current, from = anim.current?.to ?? px0, to = clampPxPerSquare(from * k);
    if (!canAnimate()) return zoomTo(to, { ...view, pxPerSquare: px0 });
    const start = performance.now();
    stopAnim();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_MS), e = 1 - (1 - t) ** 3;
      const px = clampPxPerSquare(px0 * (to / px0) ** e);
      livePx.current = px;
      setViewRaw((v) => ({ centre: v.centre, pxPerSquare: px }));
      if (t < 1) anim.current = { ...anim.current!, id: requestAnimationFrame(tick) };
      else stopAnim();
    };
    // Frames stall in a hidden or throttled tab; the timer lands the step on its target anyway.
    anim.current = { id: requestAnimationFrame(tick), to, timer: window.setTimeout(() => tick(start + ZOOM_MS), ZOOM_MS + 100) };
  };
  // Cmd/Ctrl + scroll wheel (and trackpad pinch, which arrives as Ctrl + wheel) zooms about the pointer: the point under it stays put.
  // A native listener, because React's wheel listener is passive and could not stop the page from zooming or scrolling.
  const wheelView = useRef(view);
  wheelView.current = view;
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.deltaY) return;
      e.preventDefault();
      const cur = wheelView.current;
      const k = Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.005);
      const ctm = el.getScreenCTM?.();
      const p = ctm ? new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse()) : null;
      zoomTo(cur.pxPerSquare * k, cur, p ? toWorld({ x: p.x / unitsPerSquare(cur.pxPerSquare), y: p.y / unitsPerSquare(cur.pxPerSquare) }, anchorRef.current) : cur.centre);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  // Two neighbouring steps of the 1, 2, 5 ladder are drawn at once, crossfaded by zoom. The label, scale bar and snapping follow the
  // dominant (more visible) one, so they are always a round value. Tokens and the Party Token still sit on the base squares.
  const ladder = gridLadder(pxPerSquare);
  const gridFt = ladder.dominant;
  const gridSquares = gridFt / FEET_PER_SQUARE; // one shown grid square, in base squares
  // It has no edge: lines cover whatever is in view.
  // Grid lines sit on world multiples of the step; the positions drawn are relative to the anchor.
  const gridAt = (fromSq: number, toSq: number, stepSquares: number, anchor: number) => {
    const out: number[] = [];
    for (let i = Math.ceil(fromSq / stepSquares); i * stepSquares <= toSq + 1e-6; i++) out.push((i * stepSquares - anchor) * U);
    return out;
  };
  const gridSteps = [{ ft: ladder.lo, w: ladder.wLo }, { ft: ladder.hi, w: ladder.wHi }].filter((g) => g.w > 0.03);
  const view_ = { x0: centre.x - vw / 2, y0: centre.y - vh / 2, x1: centre.x + vw / 2, y1: centre.y + vh / 2 }; // the view in world squares
  const cols = { lo: Math.floor(view_.x0), hi: Math.ceil(view_.x1) };
  const rows = { lo: Math.floor(view_.y0), hi: Math.ceil(view_.y1) };
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
    setView({ pxPerSquare, centre: { x: centre.x - (e.clientX - last.x) / pxPerSquare, y: centre.y - (e.clientY - last.y) / pxPerSquare } });
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
  // New Tokens land in view, from the square at the view centre (scanning rightwards), not at (0, 0) miles away.
  const nearView = { x: Math.floor(centre.x), y: Math.floor(centre.y) };
  const addToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void change((m) => ({ ...m, tokens: [...m.tokens, { id: crypto.randomUUID(), name: name.trim(), color, ...freeSquare(m, nearView) }] }));
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
    // Zoomed out a Marker icon covers many squares, so a drop anywhere on the icon (pixel hit radius) counts too.
    const loc = partyLocationInSquare(map, at) ?? partyLocationAt(map, { x: at.x + 0.5, y: at.y + 0.5 }, livePx.current);
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
    return { x: Math.floor(p.x / U + A.x), y: Math.floor(p.y / U + A.y) }; // snaps to squares, grid shown or not
  };
  // Ruler: transient, never saved, measures in the Map's unit. `locked` = the end is chosen. Ends are points in squares that snap to the
  // nearest centre, corner or edge midpoint of the shown grid's squares (unless Snap to grid is off); without pointer geometry (jsdom) a square's own target gives its centre.
  const [tool, setTool] = useState<Tool>("select");
  const ruler = tool === "ruler";
  const [rule, setRule] = useState<{ a: Pt; b: Pt; locked: boolean } | null>(null);
  const rulerAt = (e: { clientX: number; clientY: number }, q?: Square): Pt | null => {
    const p = worldFree(e);
    return p ? (map.snapToGrid !== false ? snapToHalf(p, gridSquares) : p) : q ? { x: q.x + 0.5, y: q.y + 0.5 } : null;
  };
  const same = (p: Pt, q: Pt) => p.x === q.x && p.y === q.y;
  // Click start then end, or press at one point and release at another.
  const rulerDown = (q: Pt | null) => { if (q && (!rule || rule.locked)) setRule({ a: q, b: q, locked: false }); };
  const rulerOver = (q: Pt | null) => { if (q && rule && !rule.locked && !same(q, rule.b)) setRule({ ...rule, b: q }); };
  const rulerEnd = (q: Pt | null) => { if (q && rule && !rule.locked && !same(q, rule.a)) setRule({ ...rule, b: q, locked: true }); };
  const pickTool = (t: Tool) => { setTool((cur) => (cur === t && t !== "select" ? "select" : t)); setRule(null); setDraft([]); setSelLine(null); setSelMarker(null); setSelToken(null); };
  const measured = rule && formatSquares(distanceSquares(rule.a, rule.b));

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
  // Only what meets the view is rendered (a margin covers strokes and badges, which are in screen pixels).
  const near = (px: number) => px / pxPerSquare; // a margin in screen pixels, in squares
  const liveLines = map.lines.map(live).filter((l) => l.points.length > 0 && boundsIntersect(boundsOf(l.points), view_, near(20)))
    .map((l) => ({ ...l, points: l.points.map(L) })); // handed to the layers relative to the anchor
  const fullIds = new Set([selLine, moved?.id, shift?.id].filter((x): x is string => !!x)); // selected or being dragged: never faded
  const selected = map.lines.find((l) => l.id === selLine);
  const [selMarker, setSelMarker] = useState<string | null>(null);
  const marker = map.markers.find((k) => k.id === selMarker);
  // A selected Marker fades like the rest; once it has faded out it is no longer selected (its editor closes).
  const markerGone = !!marker && markerOpacity(marker.placedAt ?? BATTLE_PX_PER_SQUARE, pxPerSquare, marker.priority ?? "normal") <= 0;
  useEffect(() => { if (markerGone) setSelMarker(null); }, [markerGone]);
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
  // Pointer points: `localFree` is relative to the anchor (what the layers draw in), `worldFree` absolute.
  const localFree = (e: { clientX: number; clientY: number }) => pointerSquare(svg.current, e, false, U);
  const freePoint = localFree;
  const worldFree = (e: { clientX: number; clientY: number }) => { const p = localFree(e); return p && W(p); };
  const patchMarker = (id: string, fn: (k: MapMarker) => MapMarker) => change((m) => ({ ...m, markers: m.markers.map((k) => (k.id === id ? fn(k) : k)) }));
  const pickMarker = (id: string) => {
    setSelMarker(id); setSelLine(null); setSelToken(null);
    const loc = map.markers.find((k) => k.id === id)?.locationId;
    if (loc) selectLocation(campaignId, loc);
  };
  const placeMarker = (at: Pt) => {
    const k = newMarker(at, map.markers, pxPerSquare);
    setSelMarker(k.id); setSelLine(null); setSelToken(null);
    void change((m) => ({ ...m, markers: [...m.markers, k] }));
  };
  // The scale bar and grid label read in feet below 1000 ft and in miles from there.
  // The scale bar is always exactly one shown grid square long, so it never changes size on screen; its label follows zoom.
  const barUnit = gridFt >= MILES_FROM_FEET ? "mi" : "ft";
  const bar = { amount: barUnit === "mi" ? gridFt / FEET_PER_MILE : gridFt, px: gridSquares * pxPerSquare };
  // Drawing snaps to the grid as shown (its squares change with zoom), so points land on the lines the DM sees.
  // Snapped in world space (the grid is anchored at the world origin), then handed to the layers relative to the anchor.
  const snapping = map.showGrid && map.snapToGrid !== false; // the Snap to grid setting, only while the grid is shown
  const svgPoint = (e: { clientX: number; clientY: number }) => { const w = worldFree(e); return w && L(snapping ? snapToStep(w, gridSquares) : w); };
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

  // Find: type part of a name, pick a result, and the view goes to it (see findView for the zoom per kind) and selects it.
  const [findText, setFindText] = useState("");
  const targets: FindTarget[] = [
    ...map.markers.map((k): FindTarget => ({ kind: "marker", id: k.id, label: markerText(k), at: { x: k.x, y: k.y }, placedAt: k.placedAt })),
    ...map.lines.filter((l) => l.area && l.points.length).map((l): FindTarget => ({ kind: "area", id: l.id, label: areaText(l.area!), at: lineCentre(l.points), bounds: lineBounds(l.points) })),
    ...shown.map(({ t, name }): FindTarget => ({ kind: "token", id: t.id, label: name, at: { x: t.x + 0.5, y: t.y + 0.5 } })),
    ...(map.partyToken ? [{ kind: "party", id: PARTY, label: "Party token", at: { x: map.partyToken.x + 0.5, y: map.partyToken.y + 0.5 } } as FindTarget] : []),
  ];
  const found = findTargets(targets, findText);
  const goTo = (f: FindTarget) => {
    setView(findView(f, size, pxPerSquare));
    if (f.kind === "marker") pickMarker(f.id);
    else if (f.kind === "area") pickLine(f.id);
    else if (f.kind === "token") { const t = map.tokens.find((k) => k.id === f.id); if (t) select(t); }
    setFindText("");
  };

  return (
    <div className="map-view">
      <div className="row map-toolbar" role="toolbar" aria-label="Map tools">
        <span className="map-find">
          <input type="search" role="combobox" aria-label="Find on map" aria-expanded={found.length > 0} placeholder="Find…" value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && found[0]) { e.preventDefault(); goTo(found[0]); } else if (e.key === "Escape" && findText) { e.stopPropagation(); setFindText(""); } }} />
          {findText.trim() !== "" && (
            <ul className="map-find-results" aria-label="Find results">
              {found.length === 0 ? <li className="muted">Nothing found</li> : found.slice(0, 12).map((f) => (
                <li key={f.kind + f.id}><button onClick={() => goTo(f)}>{f.label} <span className="muted">{f.kind === "party" ? "token" : f.kind}</span></button></li>
              ))}
            </ul>
          )}
        </span>
        <button aria-pressed={tool === "select"} onClick={() => pickTool("select")}>Select</button>
        <button aria-pressed={tool === "draw"} onClick={() => pickTool("draw")}>Draw</button>
        <button aria-pressed={tool === "route"} onClick={() => pickTool("route")}>Route</button>
        <button aria-pressed={tool === "marker"} onClick={() => pickTool("marker")}>Marker</button>
        <button aria-pressed={ruler} onClick={() => pickTool("ruler")}>Ruler</button>
        <span className="row zoom-ctl" role="group" aria-label="Zoom">
          <button aria-label="Zoom out" title="Zoom out (-)" onClick={() => zoomBy(1 / ZOOM_STEP)}>−</button>
          <span className="muted" aria-live="polite">{formatZoom(pxPerSquare)}</span>
          <button aria-label="Zoom in" title="Zoom in (+)" onClick={() => zoomBy(ZOOM_STEP)}>+</button>
          <button onClick={() => setView(fitView(mapBounds(map), size))} title="Zoom to everything drawn on the Map (battle scale at the start point when it is empty)">Fit all</button>
          {map.showGrid && <span className="muted" aria-label="Grid scale" title="What one grid square stands for at this zoom">1 square = {formatSquares(gridSquares)}</span>}
        </span>
        {rule && <button onClick={() => setRule(null)}>Clear measurement</button>}
      </div>
      {/* Always one line tall, so the canvas never shifts while drawing or measuring (a shift moves the next click). */}
      <div className="map-status">
        {drawing && <span className="muted" role="status" aria-label="Drawing" title="Enter or double-click to finish, Esc to cancel">Drawing {draft.length} {draft.length === 1 ? "point" : "points"}: {tool === "route" ? "" : "click the first point to close, "}Enter or double-click to finish, Esc to cancel</span>}
        {rule && <span role="status" aria-label="Measured distance">{+(distanceSquares(rule.a, rule.b) / gridSquares).toFixed(2)} squares, {measured}</span>}
      </div>
      <details className="map-settings">
        <summary>Map settings <span className="muted" aria-label="Map summary">1 square = {formatSquares(gridSquares)}</span></summary>
        <div className="row">
          <label><input aria-label="Show grid" type="checkbox" checked={map.showGrid} onChange={(e) => { const showGrid = e.target.checked; void change((m) => ({ ...m, showGrid })); }} /> Show grid</label>
          <label title="Drawing and Area drags snap to the shown grid, the ruler to its corners and centres"><input aria-label="Snap to grid" type="checkbox" checked={map.snapToGrid !== false} onChange={(e) => { const snapToGrid = e.target.checked; void change((m) => ({ ...m, snapToGrid })); }} /> Snap to grid</label>
        </div>
      </details>
      <div className="map-scroll fit">
        <svg ref={svg} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="map-canvas" role="group" aria-label="Map canvas" style={{ "--ui": U / pxPerSquare } as React.CSSProperties}>
          {/* Drag the background to pan. */}
          <rect x={box.x} y={box.y} width={box.w} height={box.h} className="map-bg" data-testid="map-pan"
            onPointerDown={panStart} onPointerMove={panMove} onPointerUp={() => { if (!panEnd()) { setSelLine(null); setSelMarker(null); setSelToken(null); } }} />
          {map.showGrid && gridSteps.map((g) => (
            <g key={g.ft} className="grid-step" opacity={+g.w.toFixed(3)} pointerEvents="none">
              {gridAt(view_.x0, view_.x1, g.ft / FEET_PER_SQUARE, A.x).map((x) => <line key={`v${x}`} x1={x} y1={box.y} x2={x} y2={box.y + box.h} className="grid-line" />)}
              {gridAt(view_.y0, view_.y1, g.ft / FEET_PER_SQUARE, A.y).map((y) => <line key={`h${y}`} x1={box.x} y1={y} x2={box.x + box.w} y2={y} className="grid-line" />)}
            </g>
          ))}
          <AreasLayer lines={liveLines} pxPerSquare={pxPerSquare} full={fullIds} labelOf={areaText} selectedId={selected?.id} selectable={tool === "select"} onSelect={pickArea} snap={snapping && gridSquares}
            fits={(l) => l.points.every((p) => p.x * U >= box.x && p.x * U <= box.x + box.w && p.y * U >= box.y && p.y * U <= box.y + box.h)}
            covers={(l) => [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].every(([x, y]) => pointInPolygon({ x: x / U, y: y / U }, l.points))}
            onShift={(id, by) => setShift({ id, by })}
            onShiftEnd={(id, by) => { if (!by) { setShift(null); return; } void patchLine(id, (l) => ({ ...l, points: l.points.map((p) => ({ x: p.x + by.x, y: p.y + by.y })) })).then(() => setShift(null)); }}
            pointAt={freePoint} onPanStart={panStart} onPanMove={panMove} onPanEnd={panEnd} />
          <LinesLayer lines={liveLines} pxPerSquare={pxPerSquare} full={fullIds} labels={labels} selectedId={selected?.id} selectable={tool === "select"} onSelect={pickLine}
            selectedSegment={selSeg} onSegment={setSelSeg}
            onSplit={(i, e) => {
              const l = selected, q = worldFree(e);
              if (!l || !q) return;
              const [a, b] = segmentsOf(l)[i];
              void patchLine(l.id, (x) => splitSegment(x, i, projectOnSegment(q, a, b)));
              setSelSeg(null);
            }} />
          {/* Under the Markers, so in the Marker tool a press on a Marker drags it rather than placing a new one. */}
          {tool === "marker" && <rect x={box.x} y={box.y} width={box.w} height={box.h} className="map-draw-surface" data-testid="map-marker-surface"
            onClick={(e) => { const p = worldFree(e); if (p) placeMarker(p); }} />}
          <MarkersLayer markers={map.markers.filter((k) => k.id === selMarker || boundsIntersect({ x0: k.x, y0: k.y, x1: k.x, y1: k.y }, view_, near(60))).map((k) => ({ ...k, ...L(k) }))} labelOf={markerText} pxPerSquare={pxPerSquare} selectedId={marker?.id} selectable={tool === "select" || tool === "marker"} svgPoint={freePoint}
            onSelect={pickMarker} onDrop={(id, at) => { const w = W(at); void patchMarker(id, (k) => ({ ...k, x: w.x, y: w.y })); }} />
          {selectedToken && speedFeet !== null && (() => {
            const r = reachArea(selectedToken, speedFeet);
            return (
              <g className="speed-ring" data-testid="speed-ring" pointerEvents="none" aria-label={`Speed ${speedFeet} ft, ${r.squares} squares`}>
                <circle cx={(r.x - A.x + r.w / 2) * U} cy={(r.y - A.y + r.h / 2) * U} r={Math.max(0, (r.w / 2) * U - 2)} />
                <text x={(r.x - A.x + r.w / 2) * U} y={(r.y - A.y) * U + 22} textAnchor="middle">{speedFeet} ft</text>
              </g>
            );
          })()}
          {shown.map(({ t, name: label, defeated, selected, linked }) => {
            const p = drag?.id === t.id ? drag : t;
            const short = tokenLabel(label);
            // Culled off-screen; faded when its square is tiny (not rendered at 0, so not dragged or clicked). Selected or dragged ones stay full.
            if (!boundsIntersect({ x0: p.x, y0: p.y, x1: p.x + 1, y1: p.y + 1 }, view_, 1)) return null;
            const forced = selected || t.id === selToken || drag?.id === t.id, fade = forced ? 1 : fadeBySize(pxPerSquare, TOKEN_MIN_PX);
            if (fade <= 0) return null;
            return (
              <g key={t.id} opacity={fade} className={"map-token" + (selected || t.id === selToken ? " selected" : "") + (defeated ? " defeated" : "")} tabIndex={0} role="button"
                aria-label={`Token ${label}${defeated ? ", defeated" : ""}`} aria-pressed={linked ? selected : undefined}
                onClick={() => select(t)}
                data-col={p.x} data-row={p.y} transform={`translate(${(p.x - A.x) * U} ${(p.y - A.y) * U})${U < CELL ? ` scale(${U / CELL})` : ""}`}
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
                data-col={p.x} data-row={p.y} transform={`translate(${(p.x - A.x + 0.5) * U} ${(p.y - A.y + 0.5) * U})`}
                onKeyDown={nudgeParty}
                onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setDrag({ id: PARTY, ...map.partyToken! }); }}
                onPointerMove={(e) => { if (drag?.id === PARTY) { const q = square(e); if (q) setDrag({ id: PARTY, ...q }); } }}
                onPointerUp={() => { if (drag?.id === PARTY) { const to = { x: drag.x, y: drag.y }; setDrag(null); void moveParty(() => to); } }}>
                {/* Never fades. Drawn at its true square size, but never smaller than PARTY_MIN_PX on screen: below that it is scaled up about
                    its square's centre (like a Marker), so it stays visible and grabbable when zoomed far out. */}
                <g style={{ transform: `scale(${Math.max(1, PARTY_MIN_PX / pxPerSquare) * (U / CELL)})` }}>
                  <circle r={CELL / 2 - 2} fill="#f1c40f" />
                  <circle r={CELL / 2 - 1} className="party-ring" fill="none" />
                  <text y={8} textAnchor="middle" className="party-star">★</text>
                </g>
                <title>Party</title>
              </g>
            );
          })()}
          {(tool === "draw" || tool === "route") && <DrawLayer box={box} points={draft.map(L)} pxPerSquare={pxPerSquare} svgPoint={svgPoint} freePoint={freePoint} route={tool === "route"}
            onAdd={(p) => setDraft((d) => [...d, W(p)])} onClose={() => finishLine(true)} onFinish={() => finishLine(false)} onCancel={() => setDraft([])} />}
          {ruler && <rect x={box.x} y={box.y} width={box.w} height={box.h} className="ruler-square"
            onPointerDown={(e) => rulerDown(rulerAt(e))} onPointerMove={(e) => rulerOver(rulerAt(e))} onPointerUp={(e) => rulerEnd(rulerAt(e))} />}
          {ruler && visibleSquares <= MAX_RULER_SQUARES && Array.from({ length: visibleSquares }, (_, i) => {
            const w = cols.hi - cols.lo, q = { x: cols.lo + (i % w), y: rows.lo + Math.floor(i / w) };
            return <rect key={`${q.x},${q.y}`} x={(q.x - A.x) * U} y={(q.y - A.y) * U} width={U} height={U} className="ruler-square" aria-label={`Square ${q.x},${q.y}`}
              onPointerDown={(e) => rulerDown(rulerAt(e, q))} onPointerMove={(e) => rulerOver(rulerAt(e, q))} onPointerEnter={(e) => rulerOver(rulerAt(e, q))}
              onPointerUp={(e) => rulerEnd(rulerAt(e, q))} onClick={(e) => rulerEnd(rulerAt(e, q))} />;
          })}
          {rule && (() => {
            const a = L(rule.a), b = L(rule.b), c = (n: number) => n * U;
            return (
              <g className="ruler-mark" pointerEvents="none">
                <line data-testid="ruler-line" x1={c(a.x)} y1={c(a.y)} x2={c(b.x)} y2={c(b.y)} />
                <ScreenSized x={c(a.x)} y={c(a.y)}><circle r={5} /></ScreenSized><ScreenSized x={c(b.x)} y={c(b.y)}><circle r={5} /></ScreenSized>
                <ScreenSized x={(c(a.x) + c(b.x)) / 2} y={(c(a.y) + c(b.y)) / 2}><text y={-8} textAnchor="middle">{measured}</text></ScreenSized>
              </g>
            );
          })()}
          {tool === "select" && selected && <PointHandles line={{ ...live(selected), points: live(selected).points.map(L) }} label={labels.get(selected.id)!} pxPerSquare={pxPerSquare} svgPoint={svgPoint}
            onMove={(index, at) => setMoved({ id: selected.id, index, at: W(at) })}
            onDrop={(index, at) => { const w = W(at); setMoved(null); void patchLine(selected.id, (l) => ({ ...l, points: l.points.map((p, i) => (i === index ? w : p)) })); }} />}
        </svg>
        {bar && (
          <div className="map-scale" role="img" aria-label={`Scale bar ${formatDistance(bar.amount, barUnit)}`}>
            {/* The bracket is as tall as it is wide (one shown grid square): the upright plus the 7px foot make bar.px. */}
            <span className="map-scale-bar map-scale-bar-v" style={{ height: Math.max(bar.px - 7, 0) }} />
            <span className="map-scale-foot">
              <span className="map-scale-bar" style={{ width: bar.px }} />
              <span>{formatDistance(bar.amount, barUnit)}</span>
            </span>
          </div>
        )}
      </div>
      {tool === "select" && selected && <LineEditor line={selected} label={labels.get(selected.id)!} length={routeLength(live(selected).points)} onDelete={deleteSelected}
        segment={selSeg} onSegment={setSelSeg}
        onSplit={(i) => { const [a, b] = segmentsOf(selected)[i]; void patchLine(selected.id, (l) => splitSegment(l, i, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })); setSelSeg(null); }}
        onKind={(i, kind) => void patchLine(selected.id, (l) => ({ ...l, segments: l.segments.map((k, j) => (i === null || j === i ? kind : k)) }))} />}
      {marker && (tool === "select" || tool === "marker") && <MarkerEditor marker={marker} label={markerText(marker)} locations={locations} pxPerSquare={pxPerSquare}
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
        {!map.partyToken && <button type="button" onClick={() => void change((m) => ({ ...m, partyToken: freeSquare(m, nearView) }))}>Add party token</button>}
        {enc && <button type="button" onClick={() => void change((m) => withCombatantTokens(m, enc.combatants, enc.spot))}>Add tokens for all combatants</button>}
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
