import type { MapLine } from "../storage/maps";
import { CELL } from "./lines";
import { areaAt } from "./areas";
import { polygonCentroid, type Pt } from "./geometry";

/** Area fills: translucent, drawn under every Line. In the Select tool a click on a fill selects the smallest Area under the pointer
 *  (`pointAt` gives the unsnapped point; without one, the clicked fill). In other tools the fills let clicks through (Draw still adds points). */
export function AreasLayer({ lines, labelOf, selectedId, selectable, pointAt, moved, onSelect, onPanStart, onPanMove, onPanEnd }: {
  lines: MapLine[]; labelOf: (area: NonNullable<MapLine["area"]>) => string; selectedId?: string; selectable: boolean;
  pointAt: (e: { clientX: number; clientY: number }) => Pt | null; moved?: { id: string; index: number; at: Pt } | null; onSelect: (id: string) => void;
  /** A press on a fill that moves pans the Map (as from empty space); one that does not move is a click and selects. `onPanEnd` says whether it moved. */
  onPanStart: (e: React.PointerEvent) => void; onPanMove: (e: React.PointerEvent) => void; onPanEnd: () => boolean;
}) {
  return (
    <g className="map-areas">
      {lines.map((raw) => {
        if (!raw.area || !raw.closed) return null;
        const l = moved?.id === raw.id ? { ...raw, points: raw.points.map((p, i) => (i === moved.index ? moved.at : p)) } : raw;
        const c = polygonCentroid(l.points);
        const d = l.points.map((p, i) => `${i ? "L" : "M"}${p.x * CELL} ${p.y * CELL}`).join(" ") + " Z";
        const text = labelOf(raw.area);
        return (
          <g key={l.id} className={"map-area" + (l.id === selectedId ? " selected" : "")}>
            <path d={d} className="map-area-fill" fill={raw.area.color} data-area={l.id} role={selectable ? "button" : undefined} aria-label={selectable ? `Area ${text}` : undefined}
              tabIndex={-1} pointerEvents={selectable ? undefined : "none"} onPointerDown={onPanStart} onPointerMove={onPanMove} onPointerUp={onPanEnd}
              onClick={(e) => { const p = pointAt(e); onSelect((p && areaAt(lines, p)?.id) || l.id); }} />
            <text className="map-area-label" x={c.x * CELL} y={c.y * CELL} textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{text}</text>
          </g>
        );
      })}
    </g>
  );
}
