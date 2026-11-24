import { useState } from "react";
import type { MapLine } from "../storage/maps";
import { CELL, segmentsOf } from "./lines";
import type { Pt } from "./geometry";
import { pointAlong, routeLength } from "./routes";

const px = (n: number) => n * CELL;

/** One segment: plain is thin, a Wall thick, a Door a gap between two stubs with a door leaf across it. */
function Segment({ a, b, kind, index }: { a: Pt; b: Pt; kind: MapLine["segments"][number]; index: number }) {
  const x1 = px(a.x), y1 = px(a.y), x2 = px(b.x), y2 = px(b.y);
  if (kind !== "door") return <line x1={x1} y1={y1} x2={x2} y2={y2} className={kind === "wall" ? "map-wall" : "map-plain"} data-segment={index} pointerEvents="none" />;
  const lerp = (t: number) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t] as const;
  const [g1x, g1y] = lerp(0.25), [g2x, g2y] = lerp(0.75);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, len = Math.hypot(x2 - x1, y2 - y1) * 0.5;
  return (
    <g data-segment={index} pointerEvents="none">
      <line x1={x1} y1={y1} x2={g1x} y2={g1y} className="map-plain" /><line x1={g2x} y1={g2y} x2={x2} y2={y2} className="map-plain" />
      <rect className="map-door" x={-len / 2} y={-3} width={len} height={6} transform={`translate(${(g1x + g2x) / 2} ${(g1y + g2y) / 2}) rotate(${angle})`} />
    </g>
  );
}

/** The drawn Lines and Shapes. Each is a button (in the Select tool): clicking selects it. `moved` is a point being dragged, shown at its pending place. */
export function LinesLayer({ lines, labels, selectedId, onSelect, moved, selectable, perSquare, unit }: {
  lines: MapLine[]; labels: Map<string, string>; selectedId?: string; onSelect: (id: string) => void; perSquare: number; unit: string;
  moved?: { id: string; index: number; at: Pt } | null; selectable: boolean;
}) {
  return (
    <g className="map-lines">
      {lines.map((raw) => {
        const l = moved?.id === raw.id ? { ...raw, points: raw.points.map((p, i) => (i === moved.index ? moved.at : p)) } : raw;
        const label = labels.get(l.id)!;
        const d = l.points.map((p, i) => `${i ? "L" : "M"}${px(p.x)} ${px(p.y)}`).join(" ") + (l.closed ? " Z" : "");
        return (
          <g key={l.id} className={"map-line" + (l.route ? " map-route" : "") + (l.id === selectedId ? " selected" : "")} role="button" aria-label={label} aria-pressed={l.id === selectedId}
            tabIndex={selectable ? 0 : -1} pointerEvents={selectable ? undefined : "none"}
            onClick={() => onSelect(l.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(l.id); } }}>
            {l.route
              ? <path d={d} className="map-route-path" fill="none" pointerEvents="none" />
              : segmentsOf(l).map(([a, b], i) => <Segment key={i} a={a} b={b} kind={l.segments[i] ?? "plain"} index={i} />)}
            <path d={d} className="map-hit" fill="none" />
            {l.route && (() => { const m = pointAlong(l.points, 0.5); return <text className="map-route-label" x={px(m.x)} y={px(m.y)} textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{routeLength(l.points, perSquare, unit)}</text>; })()}
          </g>
        );
      })}
    </g>
  );
}

/** Draggable handles on the selected Line's points; the drag is reported live and saved on release. */
export function PointHandles({ line, label, svgPoint, onMove, onDrop }: {
  line: MapLine; label: string; svgPoint: (e: { clientX: number; clientY: number }) => Pt | null;
  onMove: (index: number, at: Pt) => void; onDrop: (index: number, at: Pt) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <g className="map-handles">
      {line.points.map((p, i) => (
        <circle key={i} className="map-handle" cx={px(p.x)} cy={px(p.y)} role="button" tabIndex={-1} aria-label={`Point ${i + 1} of ${label}`}
          onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setActive(i); }}
          onPointerMove={(e) => { if (active === i) { const q = svgPoint(e); if (q) onMove(i, q); } }}
          onPointerUp={(e) => { if (active === i) { const q = svgPoint(e); setActive(null); if (q) onDrop(i, q); } }} />
      ))}
    </g>
  );
}
