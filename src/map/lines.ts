import { useLayoutEffect, useState, type RefObject } from "react";
import type { MapLine, SegmentKind } from "../storage/maps";
import { snapToStep, type Pt } from "./geometry";

export const CELL = 40; // pixels per square in the canvas's own coordinates
export const HIT_PX = 10; // screen pixels: how close a pointer must be to count as on a point or a segment

/** Pointer to a point in squares, through the SVG's own transform (the canvas is letterboxed, so the element box is not the drawing's box).
 *  `snap` is the shown grid's square size in squares (its corners are snap points), or false for a free point. Null when the transform is unavailable. */
export function pointerSquare(el: SVGSVGElement | null, e: { clientX: number; clientY: number }, snap: number | false): Pt | null {
  const ctm = el?.getScreenCTM?.();
  if (!el || !ctm) return null;
  const pt = el.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(ctm.inverse());
  const q = { x: p.x / CELL, y: p.y / CELL };
  return snap ? snapToStep(q, snap) : q;
}

/** Screen pixels per SVG unit (the letterboxed canvas scales by its tighter side); 1 where nothing is laid out. Follows resizes. */
export function usePxPerUnit(svg: RefObject<SVGSVGElement | null>, boxW: number, boxH: number): number {
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const measure = () => {
      const r = svg.current?.getBoundingClientRect();
      setK(r && r.width > 0 && r.height > 0 ? Math.min(r.width / boxW, r.height / boxH) : 1);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [svg, boxW, boxH]);
  return k;
}

/** A new Line from drawn points: every segment plain; a closed one has one more segment (last back to first). */
export const newLine = (points: Pt[], closed: boolean, route = false): MapLine => ({
  id: crypto.randomUUID(), points, closed, segments: Array<SegmentKind>(closed ? points.length : points.length - 1).fill("plain"), ...(route ? { route: true as const } : {}),
});

/** "Line 1", "Shape 2", "Route 1": numbered by order among Lines of the same kind. */
export function lineLabels(lines: MapLine[]): Map<string, string> {
  let open = 0, shapes = 0, routes = 0;
  return new Map(lines.map((l) => [l.id, l.route && !l.closed ? `Route ${++routes}` : l.closed ? `Shape ${++shapes}` : `Line ${++open}`]));
}

/** The segments of a Line as point pairs, in segment order. */
export function segmentsOf(l: Pick<MapLine, "points" | "closed">): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  for (let i = 0; i < l.points.length - 1; i++) out.push([l.points[i], l.points[i + 1]]);
  if (l.closed && l.points.length > 2) out.push([l.points[l.points.length - 1], l.points[0]]);
  return out;
}
