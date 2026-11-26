import { useState } from "react";
import type { MapLine } from "../storage/maps";
import { segmentsOf, unitsPerSquare } from "./lines";
import { OnTop, ScreenSized } from "./ScreenSized";
import { AREA_MIN_PX, SEGMENT_MIN_PX, boundsOf, fadeBySize, polylineLength, routeLabelOpacity, type Pt } from "./geometry";
import { pointAlong, routeLength } from "./routes";


/** One segment: plain is thin, a Wall thick, a Door a gap between two stubs with a door leaf across it. */
function Segment({ a, b, u, kind, index, opacity }: { a: Pt; b: Pt; u: number; kind: MapLine["segments"][number]; index: number; opacity: number }) {
  const x1 = a.x * u, y1 = a.y * u, x2 = b.x * u, y2 = b.y * u;
  if (kind !== "door") return <line x1={x1} y1={y1} x2={x2} y2={y2} className={kind === "wall" ? "map-wall" : "map-plain"} data-segment={index} opacity={opacity} pointerEvents="none" />;
  const lerp = (t: number) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t] as const;
  const [g1x, g1y] = lerp(0.25), [g2x, g2y] = lerp(0.75);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI, len = Math.hypot(x2 - x1, y2 - y1) * 0.5;
  return (
    <g data-segment={index} opacity={opacity} pointerEvents="none">
      <line x1={x1} y1={y1} x2={g1x} y2={g1y} className="map-plain" /><line x1={g2x} y1={g2y} x2={x2} y2={y2} className="map-plain" />
      <rect className="map-door" x={-len / 2} y={-3} width={len} height={6} transform={`translate(${(g1x + g2x) / 2} ${(g1y + g2y) / 2}) rotate(${angle})`} />
    </g>
  );
}

/** The drawn Lines and Shapes (as shown, with any drag in progress). Each is a button (in the Select tool): clicking selects it.
 *  The selected Line's segments are buttons too: clicking one picks it for the editor (`selectedSegment`). */
export function LinesLayer({ lines, pxPerSquare, full, labels, selectedId, onSelect, selectedSegment, onSegment, onSplit, selectable }: {
  lines: MapLine[]; labels: Map<string, string>; selectedId?: string;
  /** Screen pixels per square: segments shorter than a few pixels fade out (and stop catching clicks). */
  pxPerSquare: number;
  /** Ids drawn at full opacity whatever their size: the selected, dragged or being-edited Line. */
  full: ReadonlySet<string>;
  onSelect: (id: string) => void;
  selectedSegment: number | null; onSegment: (index: number) => void; selectable: boolean;
  /** Double-click on a segment: add a point there. */
  onSplit: (index: number, e: { clientX: number; clientY: number }) => void;
}) {
  const sel = selectable ? lines.find((l) => l.id === selectedId) : undefined;
  const u = unitsPerSquare(pxPerSquare), px = (n: number) => n * u;
  return (
    <g className="map-lines">
      {[...lines.filter((l) => !l.route), ...lines.filter((l) => l.route)].map((l) => { // Routes over Shapes and walls
        const label = labels.get(l.id)!;
        const d = l.points.map((p, i) => `${i ? "L" : "M"}${px(p.x)} ${px(p.y)}`).join(" ") + (l.closed ? " Z" : "");
        // A Line fades as one piece, by its whole size, so a shape never loses its short sides before the rest: a Route by its length, an Area
        // by its larger side (as its fill does), any other Line by the larger side of its box. 0 means not drawn and not hit.
        const forced = full.has(l.id), segs = segmentsOf(l), b = boundsOf(l.points), side = Math.max(b.x1 - b.x0, b.y1 - b.y0) * pxPerSquare;
        const routeF = l.route && !forced ? fadeBySize(polylineLength(l.points, false) * pxPerSquare, SEGMENT_MIN_PX) : 1;
        const lineF = forced ? 1 : l.route ? routeF : fadeBySize(side, l.area ? AREA_MIN_PX : SEGMENT_MIN_PX);
        const op = segs.map(() => lineF);
        if (!op.some((o) => o > 0)) return null;
        const hit = segs.flatMap(([a, c], i) => (op[i] > 0 ? [`M${px(a.x)} ${px(a.y)}L${px(c.x)} ${px(c.y)}`] : [])).join("");
        return (
          <g key={l.id} className={"map-line" + (l.route ? " map-route" : "") + (l.id === selectedId ? " selected" : "")} role="button" aria-label={label} aria-pressed={l.id === selectedId}
            tabIndex={selectable ? 0 : -1} pointerEvents={selectable ? undefined : "none"}
            onClick={() => onSelect(l.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(l.id); } }}>
            {l.route
              ? <path d={d} className="map-route-path" fill="none" opacity={routeF} pointerEvents="none" />
              : segs.map(([a, c], i) => (op[i] > 0 ? <Segment key={i} a={a} b={c} u={u} kind={l.segments[i] ?? "plain"} index={i} opacity={op[i]} /> : null))}
            <path d={hit} className="map-hit" fill="none" />
            {l.route && (() => {
              const text = routeLength(l.points), labelF = routeLabelOpacity(routeF, side, text);
              if (labelF <= 0) return null;
              const m = pointAlong(l.points, 0.5);
              return <OnTop><ScreenSized x={px(m.x)} y={px(m.y)} opacity={labelF}><text className="map-route-label" data-route={l.id} textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{text}</text></ScreenSized></OnTop>;
            })()}
          </g>
        );
      })}
      {sel && segmentsOf(sel).map(([a, b], i) => (
        <line key={i} x1={px(a.x)} y1={px(a.y)} x2={px(b.x)} y2={px(b.y)} className={"map-seg-hit" + (i === selectedSegment ? " selected" : "")}
          role="button" tabIndex={-1} aria-label={`Segment ${i + 1} of ${labels.get(sel.id)}`} aria-pressed={i === selectedSegment} onClick={() => onSegment(i)} onDoubleClick={(e) => onSplit(i, e)} />
      ))}
    </g>
  );
}

/** Draggable handles on the selected Line's points; the drag is reported live and saved on release. */
export function PointHandles({ line, label, pointLabel, pxPerSquare, svgPoint, onMove, onDrop }: {
  line: MapLine; label: string; pxPerSquare: number; svgPoint: (e: { clientX: number; clientY: number }) => Pt | null;
  /** Each handle's name (default "Point <n> of <label>"). */
  pointLabel?: (index: number) => string;
  onMove: (index: number, at: Pt) => void; onDrop: (index: number, at: Pt) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const px = (n: number) => n * unitsPerSquare(pxPerSquare);
  return (
    <g className="map-handles">
      {line.points.map((p, i) => (
        <circle key={i} className="map-handle" cx={px(p.x)} cy={px(p.y)} role="button" tabIndex={-1} aria-label={pointLabel ? pointLabel(i) : `Point ${i + 1} of ${label}`}
          onPointerDown={(e) => { e.stopPropagation(); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); setActive(i); }}
          onPointerMove={(e) => { if (active === i) { const q = svgPoint(e); if (q) onMove(i, q); } }}
          onPointerUp={(e) => { if (active === i) { const q = svgPoint(e); setActive(null); if (q) onDrop(i, q); } }} />
      ))}
    </g>
  );
}
