/** Pure map geometry. Coordinates are in squares; `pxPerUnit` is screen pixels per square. */
export interface Pt { x: number; y: number }

/** The nearest grid corner. */
export const snapToCorner = (p: Pt): Pt => ({ x: Math.round(p.x) + 0, y: Math.round(p.y) + 0 }); // + 0 turns -0 into 0

/** Length of a polyline; a closed one adds the segment from the last point back to the first. */
export function polylineLength(points: Pt[], closed: boolean): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  if (closed) sum += Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
  return sum;
}

/** Even-odd ray cast: right for convex and concave polygons alike. Fewer than 3 points enclose nothing. */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Unsigned area (shoelace), for choosing the smallest of nested Shapes. */
export function polygonArea(poly: Pt[]): number {
  if (poly.length < 3) return 0;
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  return Math.abs(s) / 2;
}

export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Is `p` within `radiusPx` screen pixels of the segment? */
export const hitsSegment = (p: Pt, a: Pt, b: Pt, pxPerUnit: number, radiusPx: number) => distanceToSegment(p, a, b) * pxPerUnit <= radiusPx;
/** Is `p` within `radiusPx` screen pixels of the point `q`? */
export const hitsPoint = (p: Pt, q: Pt, pxPerUnit: number, radiusPx: number) => Math.hypot(p.x - q.x, p.y - q.y) * pxPerUnit <= radiusPx;

/** Centre of mass of a polygon (for placing a label); the mean of the points when it has no area. */
export function polygonCentroid(poly: Pt[]): Pt {
  const mean = () => ({ x: poly.reduce((s, p) => s + p.x, 0) / (poly.length || 1), y: poly.reduce((s, p) => s + p.y, 0) / (poly.length || 1) });
  if (poly.length < 3) return mean();
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    a += f; cx += (poly[j].x + poly[i].x) * f; cy += (poly[j].y + poly[i].y) * f;
  }
  return a === 0 ? mean() : { x: cx / (3 * a), y: cy / (3 * a) };
}
