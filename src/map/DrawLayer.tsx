import { useState } from "react";
import { HIT_PX, unitsPerSquare } from "./lines";
import { hitsPoint, type Pt } from "./geometry";

/** The Draw tool's overlay: a click adds a point, the first point closes the Shape, a double-click finishes an open Line.
 *  `route` is the Route tool: it never closes (the first point is just another point). Enter and Esc are handled by the panel (they go through the shortcut registry). */
export function DrawLayer({ box, points, pxPerSquare, svgPoint, freePoint, route, onAdd, onClose, onFinish, onCancel }: {
  box: { x: number; y: number; w: number; h: number }; points: Pt[]; pxPerSquare: number; svgPoint: (e: { clientX: number; clientY: number }) => Pt | null; freePoint?: (e: { clientX: number; clientY: number }) => Pt | null; route?: boolean;
  onAdd: (p: Pt) => void; onClose: () => void; onFinish: () => void; onCancel: () => void;
}) {
  const [cursor, setCursor] = useState<Pt | null>(null);
  const last = points[points.length - 1], U = unitsPerSquare(pxPerSquare);
  return (
    <g className="map-draw">
      <rect x={box.x} y={box.y} width={box.w} height={box.h} className="map-draw-surface" data-testid="map-draw"
        onPointerMove={(e) => setCursor(svgPoint(e))}
        onClick={(e) => {
          const p = svgPoint(e);
          if (!p) return;
          // closing is judged on the unsnapped pointer: at another zoom the shown grid is coarser, so the snapped point can land away from the first point
          const raw = freePoint?.(e) ?? p;
          const nearFirst = points.length > 0 && (hitsPoint(p, points[0], pxPerSquare, HIT_PX) || hitsPoint(raw, points[0], pxPerSquare, HIT_PX));
          if (!route && points.length >= 3 && nearFirst) return onClose();
          if (last && last.x === p.x && last.y === p.y) return; // the second click of a double-click
          if (!route && points.length === 1 && nearFirst) return;
          onAdd(p);
        }}
        onDoubleClick={() => (points.length >= 2 ? onFinish() : onCancel())} />
      {points.length > 0 && (
        <g className="map-draft" pointerEvents="none">
          <polyline points={points.map((p) => `${p.x * U},${p.y * U}`).join(" ")} fill="none" className="map-draft-line" />
          {cursor && last && <line x1={last.x * U} y1={last.y * U} x2={cursor.x * U} y2={cursor.y * U} className="map-draft-line preview" data-testid="draw-preview" />}
          {points.map((p, i) => <circle key={i} cx={p.x * U} cy={p.y * U} className={"map-draft-point" + (i === 0 && !route ? " first" : "")} />)}
        </g>
      )}
    </g>
  );
}
