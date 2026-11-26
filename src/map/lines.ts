import { useLayoutEffect, useState, type RefObject } from "react";
import type { MapLine, SegmentKind } from "../storage/maps";
import { snapToStep, type Pt } from "./geometry";

export const CELL = 40; // SVG units per square at 1 px per square and closer; a Token is laid out in a CELL-sized box
/** SVG units per square at this zoom: CELL down to 1 px per square, then shrinking with the zoom (CELL per screen pixel), so the viewBox stays
 *  within about CELL times the canvas's pixels. Chrome stops drawing and hit-testing rects and non-scaling strokes once coordinates reach tens
 *  of millions of units, which a fixed CELL hit at a view about 1,600 miles wide. */
export const unitsPerSquare = (pxPerSquare: number) => CELL * Math.min(1, pxPerSquare);
export const HIT_PX = 10; // screen pixels: how close a pointer must be to count as on a point or a segment

/** Pointer to a point in squares, through the SVG's own transform (the canvas is letterboxed, so the element box is not the drawing's box).
 *  `snap` is the shown grid's square size in squares (its corners are snap points), or false for a free point. Null when the transform is unavailable. */
export function pointerSquare(el: SVGSVGElement | null, e: { clientX: number; clientY: number }, snap: number | false, u = CELL): Pt | null {
  const ctm = el?.getScreenCTM?.();
  if (!el || !ctm) return null;
  const pt = el.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(ctm.inverse());
  const q = { x: p.x / u, y: p.y / u };
  return snap ? snapToStep(q, snap) : q;
}

/** Canvas size assumed where nothing is laid out (jsdom). */
const FALLBACK_SIZE = { w: 800, h: 500 };
/** The canvas's size in screen pixels; follows resizes. The SVG's viewBox is built from it, in SVG units (see unitsPerSquare). */
export function useCanvasSize(svg: RefObject<SVGSVGElement | null>): { w: number; h: number } {
  const [size, setSize] = useState(FALLBACK_SIZE);
  useLayoutEffect(() => {
    const el = svg.current;
    const measure = () => {
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 && r.height > 0 ? { w: r.width, h: r.height } : FALLBACK_SIZE;
      setSize((cur) => (cur.w === next.w && cur.h === next.h ? cur : next));
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" || !el ? null : new ResizeObserver(measure);
    if (el) ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [svg]);
  return size;
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

/** Split segment `index` by adding a point at `at` (a point on it): the two halves keep the original's type. */
export function splitSegment(l: MapLine, index: number, at: Pt): MapLine {
  if (index < 0 || index >= l.segments.length) return l;
  const points = [...l.points], segments = [...l.segments];
  points.splice(index + 1, 0, at);
  segments.splice(index, 1, segments[index], segments[index]);
  return { ...l, points, segments };
}

/** The segments of a Line as point pairs, in segment order. */
export function segmentsOf(l: Pick<MapLine, "points" | "closed">): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  for (let i = 0; i < l.points.length - 1; i++) out.push([l.points[i], l.points[i + 1]]);
  if (l.closed && l.points.length > 2) out.push([l.points[l.points.length - 1], l.points[0]]);
  return out;
}
