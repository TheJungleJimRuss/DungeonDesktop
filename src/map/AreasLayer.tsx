import { useRef } from "react";
import type { MapLine } from "../storage/maps";
import { unitsPerSquare } from "./lines";
import { areaAt } from "./areas";
import { ScreenSized } from "./ScreenSized";
import { AREA_MIN_PX, boundsOf, fadeBySize, labelWidthPx, polygonCentroid, snapToStep, type Pt } from "./geometry";

/** Area fills: translucent, drawn under every Line (as shown, with any drag in progress). In the Select tool a click on a fill selects the
 *  smallest Area under the pointer (`pointAt` gives the unsnapped point; without one, the clicked fill). Dragging the selected Area moves the
 *  whole Shape (`onShift` live, `onShiftEnd` on release; by whole shown-grid squares when `snap` gives their size); dragging any other fill pans the Map.
 *  In other tools the fills let clicks through (Draw still adds points). */
export function AreasLayer({ lines, pxPerSquare, full, labelOf, selectedId, selectable, snap, fits, covers, pointAt, onSelect, onShift, onShiftEnd, onPanStart, onPanMove, onPanEnd }: {
  lines: MapLine[];
  /** Screen pixels per square: an Area a few pixels across fades out (fill and name), not rendered and not hit at 0; its name hides first, when it no longer fits. */
  pxPerSquare: number;
  /** Ids drawn at full opacity whatever their size (selected or being dragged). */
  full: ReadonlySet<string>;
  labelOf: (area: NonNullable<MapLine["area"]>) => string; selectedId?: string; selectable: boolean; snap: number | false;
  /** True when the whole Area is inside the shown view; only then can it be dragged (otherwise a press pans the Map). */
  fits: (area: MapLine) => boolean;
  /** True when the Area fills the whole shown view: it then becomes plain background (no hit target, no label). */
  covers: (area: MapLine) => boolean;
  pointAt: (e: { clientX: number; clientY: number }) => Pt | null; onSelect: (id: string) => void;
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
    const from = id === selectedId && area && fits(area) ? pointAt(e) : null;
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
        const c = polygonCentroid(l.points);
        const d = l.points.map((p, i) => `${i ? "L" : "M"}${p.x * U} ${p.y * U}`).join(" ") + " Z";
        const text = labelOf(l.area);
        const b = boundsOf(l.points), forced = full.has(l.id);
        const fade = forced ? 1 : fadeBySize(Math.max(b.x1 - b.x0, b.y1 - b.y0) * pxPerSquare, AREA_MIN_PX);
        const need = labelWidthPx(text), labelFade = forced ? 1 : Math.min(fade, fadeBySize((b.x1 - b.x0) * pxPerSquare, need, need * 0.25));
        if (covers(l)) return <path key={l.id} d={d} className="map-area-fill map-area-backdrop" fill={l.area.color} data-area={l.id} pointerEvents="none" />;
        if (fade <= 0) return null;
        return (
          <g key={l.id} className={"map-area" + (l.id === selectedId ? " selected" : "")}>
            <path d={d} className="map-area-fill" fill={l.area.color} opacity={fade} data-area={l.id} role={selectable ? "button" : undefined} aria-label={selectable ? `Area ${text}` : undefined}
              tabIndex={-1} pointerEvents={selectable ? undefined : "none"} onPointerDown={down(l.id)} onPointerMove={move} onPointerUp={up}
              onClick={(e) => { if (justDragged.current) { justDragged.current = false; return; } const p = pointAt(e); onSelect((p && areaAt(hittable, p)?.id) || l.id); }} />
            {labelFade > 0 && <ScreenSized x={c.x * U} y={c.y * U} opacity={labelFade}><text className="map-area-label" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{text}</text></ScreenSized>}
          </g>
        );
      })}
    </g>
  );
}
