import { formatSquares } from "./scale";
import { polylineLength, type Pt } from "./geometry";

/** A Route's total length from the fixed 5 ft base square, every segment (never closing back): "35 ft", "3.2 mi" (miles from 1,000 ft). */
export const routeLength = (points: Pt[]): string => formatSquares(polylineLength(points, false));

/** The point `t` (0 to 1) of the way along the path, by length; the first point when the path has no length. */
export function pointAlong(points: Pt[], t: number): Pt {
  const total = polylineLength(points, false);
  if (points.length < 2 || total === 0) return points[0];
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len) { const f = len === 0 ? 0 : left / len; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
    left -= len;
  }
  return points[points.length - 1];
}
