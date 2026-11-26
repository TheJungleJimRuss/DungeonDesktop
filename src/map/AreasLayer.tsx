import { useRef } from "react";
import { areaPriorityOf, type MapLine } from "../storage/maps";
import { unitsPerSquare } from "./lines";
import { areaAt } from "./areas";
import { OnTop, ScreenSized } from "./ScreenSized";
import { AREA_MIN_PX, areaLabelOpacity, boundsOf, fadeBySize, pointInArea, pointInPolygon, ringPath, snapToStep, type Pt } from "./geometry";

/** Area fills: translucent, drawn under every Line (as shown, with any drag in progress). In the Select tool a click on a fill selects the
 *  smallest Area under the pointer (`pointAt` gives the unsnapped point; without one, the clicked fill). Dragging the selected Area moves the
 *  whole Shape (`onShift` live, `onShiftEnd` on release; by whole shown-grid squares when `snap` gives their size); dragging any other fill pans the Map.
 *  In other tools the fills let clicks through (Draw still adds points). An Area's Holes are cut out of its fill (one evenodd path), so a click
 *  there is not on the Area: it selects a smaller Area under it, else acts like a click on empty Map (`onEmpty`). */
export function AreasLayer({ lines, pxPerSquare, full, labelOf, labelAt, selectedId, selectable, snap, fits, covers, pointAt, onSelect, onEmpty, onShift, onShiftEnd, onPanStart, onPanMove, onPanEnd }: {
  lines: MapLine[];
  /** Screen pixels per square: an Area a few pixels across fades out (fill and name), not rendered and not hit at 0; its name hides first, when it no longer fits. */
  pxPerSquare: number;
  /** Ids drawn at full opacity whatever their size (selected or being dragged). */
  full: ReadonlySet<string>;
  labelOf: (area: NonNullable<MapLine["area"]>) => string;
  /** Where Area `id`'s label goes, as drawn (see labelPoint; worked out on the stored arrays so its cache holds across renders). */
  labelAt: (id: string) => Pt; selectedId?: string; selectable: boolean; snap: number | false;
  /** True when the whole Area is inside the shown view; only then can it be dragged (otherwise a press pans the Map). */
  fits: (area: MapLine) => boolean;
  /** True when the Area fills the whole shown view: it then becomes plain background (no hit target, no label). */
  covers: (area: MapLine) => boolean;
  pointAt: (e: { clientX: number; clientY: number }) => Pt | null; onSelect: (id: string) => void;
  /** A click that lands in a Hole with no other Area under it (as a click on empty Map). */
  onEmpty: () => void;
  onShift: (id: string, by: Pt) => void; onShiftEnd: (id: string, by: Pt | null) => void;
  /** A press on a fill that moves pans the Map (as from empty space); one that does not move is a click and selects. `onPanEnd` says whether it moved. */
  onPanStart: (e: React.PointerEvent) => void; onPanMove: (e: React.PointerEvent) => void; onPanEnd: () => boolean;
}) {
  const U = unitsPerSquare(pxPerSquare);
  const drag = useRef<{ id: string; from: Pt; by: Pt | null } | null>(null);
  const faded = (l: MapLine) => { const b = boundsOf(l.points); return !full.has(l.id) && fadeBySize(Math.max(b.x1 - b.x0, b.y1 - b.y0) * pxPerSquare, AREA_MIN_PX) <= 0; };
  const hittable = lines.filter((l) => !faded(l)); // a faded Area is not clickable, so the smallest-Area pick skips it
  const justDragged = useRef(false);
  const down = (id: string) => (e: React.PointerEvent) => {
    const area = lines.find((l) => l.id === id);
    const p = id === selectedId && area && fits(area) ? pointAt(e) : null;
    const from = p && area && pointInArea(p, area.points, area.area?.holes) ? p : null; // a press in a Hole doesn't grab the Area
    if (!from) { onPanStart(e); return; }
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id, from, by: null };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) { onPanMove(e); return; }
    const p = pointAt(e);
    if (!p) return;
    const raw = { x: p.x - d.from.x, y: p.y - d.from.y };
    const by = snap ? snapToStep(raw, snap) : raw;
    if (!d.by && by.x === 0 && by.y === 0) return;
    drag.current = { ...d, by };
    onShift(d.id, by);
  };
  const up = () => {
    const d = drag.current;
    if (!d) { onPanEnd(); return; }
    drag.current = null;
    justDragged.current = !!d.by;
    onShiftEnd(d.id, d.by && (d.by.x || d.by.y) ? d.by : null);
  };
  return (
    <g className="map-areas">
      {lines.map((l) => {
        if (!l.area || !l.closed) return null;
        const c = labelAt(l.id);
        const d = [l.points, ...(l.area.holes ?? [])].map((r) => ringPath(r, U)).join(" ");
        const text = labelOf(l.area);
        const b = boundsOf(l.points), forced = full.has(l.id);
        const sizePx = Math.max(b.x1 - b.x0, b.y1 - b.y0) * pxPerSquare;
        const fade = forced ? 1 : fadeBySize(sizePx, AREA_MIN_PX);
        const labelFade = forced ? 1 : areaLabelOpacity(fade, (b.x1 - b.x0) * pxPerSquare, text, areaPriorityOf(l.area), sizePx);
        if (covers(l)) return <path key={l.id} d={d} className="map-area-fill map-area-backdrop" fill={l.area.color} fillRule="evenodd" data-area={l.id} pointerEvents="none" />;
        if (fade <= 0) return labelFade > 0 ? ( // a Highest or Always Area too small to draw: a dot and its label
          <g key={l.id} className="map-area map-area-faded">
            <ScreenSized x={c.x * U} y={c.y * U}><circle r={3} fill={l.area.color} className="map-area-dot" pointerEvents="none" /></ScreenSized>
            <OnTop><ScreenSized x={c.x * U} y={c.y * U}><text className="map-area-label" y={-8} textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{text}</text></ScreenSized></OnTop>
          </g>
        ) : null;
        return (
          <g key={l.id} className={"map-area" + (l.id === selectedId ? " selected" : "")}>
            <path d={d} className="map-area-fill" fill={l.area.color} fillRule="evenodd" opacity={fade} data-area={l.id} role={selectable ? "button" : undefined} aria-label={selectable ? `Area ${text}` : undefined}
              tabIndex={-1} pointerEvents={selectable ? undefined : "none"} onPointerDown={down(l.id)} onPointerMove={move} onPointerUp={up}
              onClick={(e) => { if (justDragged.current) { justDragged.current = false; return; } const p = pointAt(e); if (!p) { onSelect(l.id); return; } const hit = areaAt(hittable, p); if (hit) onSelect(hit.id); else if (l.area?.holes?.some((h) => pointInPolygon(p, h))) onEmpty(); else onSelect(l.id); }} />
            {labelFade > 0 && <OnTop><ScreenSized x={c.x * U} y={c.y * U} opacity={labelFade}><text className="map-area-label" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{text}</text></ScreenSized></OnTop>}
          </g>
        );
      })}
    </g>
  );
}

/** The selected Area's Hole edges (anchor-relative `holes`): a thin outline each, under a wide invisible hit stroke that selects the Hole.
 *  `selected` is the selected Hole's index. With `inert` (while Subtract shape waits) they still draw but let clicks through to what is under them (inline, to beat the CSS rule). */
export function HoleEdges({ holes, label, pxPerSquare, selected, inert, onSelect }: {
  holes: Pt[][]; label: string; pxPerSquare: number; selected: number | null; inert: boolean; onSelect: (index: number) => void;
}) {
  const U = unitsPerSquare(pxPerSquare);
  return (
    <g className="map-holes">
      {holes.map((h, i) => (
        <g key={i} className={"map-hole" + (i === selected ? " selected" : "")}>
          <path d={ringPath(h, U)} className="map-hole-edge" fill="none" pointerEvents="none" />
          <path d={ringPath(h, U)} className="map-hole-hit" fill="none" role="button" tabIndex={-1} aria-label={`Hole ${i + 1} of ${label}`} aria-pressed={i === selected}
            style={inert ? { pointerEvents: "none" } : undefined} onClick={() => onSelect(i)} />
        </g>
      ))}
    </g>
  );
}
