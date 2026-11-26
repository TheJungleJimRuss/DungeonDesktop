/** Pure map geometry. Coordinates are in squares; `pxPerUnit` is screen pixels per square. */
export interface Pt { x: number; y: number }

/** The nearest grid corner. */
/** Nearest multiple of `step` squares on both axes (the shown grid's corners when `step` is its square size). Rounded to 6 decimals,
 *  so a step like 1/3 stores tidy numbers. */
export const snapToStep = (p: Pt, step: number): Pt => {
  const r = (n: number) => +(Math.round(n / step) * step).toFixed(6) + 0; // + 0 turns -0 into 0
  return { x: r(p.x), y: r(p.y) };
};
/** Nearest grid corner, edge midpoint or square centre (half-square steps) of a grid whose squares are `step` squares wide. */
export const snapToHalf = (p: Pt, step = 1): Pt => snapToStep(p, step / 2);
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

/** The point on segment a-b nearest to `p`. */
export function projectOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
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

/** Opacity 0..1 for something `screenPx` pixels big: 0 at or below `minPx`, ramping linearly across `band` px above it (default `minPx`, so it is
 *  fully there at twice the minimum), then 1. Things fade rather than pop. */
export function fadeBySize(screenPx: number, minPx: number, band = minPx): number {
  if (screenPx <= minPx) return 0;
  if (band <= 0 || screenPx >= minPx + band) return 1;
  return (screenPx - minPx) / band;
}
/** How many times the placing zoom a Marker stays fully visible while zooming out, per Priority. */
export const MARKER_FACTOR = { minor: 3, normal: 10, major: 100, always: Infinity } as const;
/** Opacity 0..1 of a Marker: 1 while `placedAt / pxPerSquare` is at or below its Priority's factor, then a linear ramp (in log space) to 0 at 1.5x the factor.
 *  Zooming in (ratio below 1) is always 1. */
export function markerOpacity(placedAt: number, pxPerSquare: number, priority: keyof typeof MARKER_FACTOR = "normal"): number {
  const f = MARKER_FACTOR[priority], ratio = placedAt / pxPerSquare;
  if (!(ratio > f)) return 1;
  return Math.max(0, 1 - Math.log(ratio / f) / Math.log(1.5));
}
/** Fade thresholds (on-screen px): a Line segment's length, an Area's larger side, a Token's square. */
export const SEGMENT_MIN_PX = 4, AREA_MIN_PX = 6, TOKEN_MIN_PX = 3;
/** On-screen length of a segment given pixels per square. */
export const segmentScreenLength = (a: Pt, b: Pt, pxPerUnit: number) => Math.hypot(b.x - a.x, b.y - a.y) * pxPerUnit;
/** Rough on-screen width of a 13px label (about 0.6 em per character). The label fades out when this exceeds the Area's on-screen width. */
export const labelWidthPx = (text: string) => text.length * 7.8;

export interface Bounds { x0: number; y0: number; x1: number; y1: number }
export function boundsOf(points: Pt[]): Bounds {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
/** Do the bounds meet the view (widened by `margin` on every side)? Touching counts. */
export const boundsIntersect = (b: Bounds, view: Bounds, margin = 0) =>
  b.x1 >= view.x0 - margin && b.x0 <= view.x1 + margin && b.y1 >= view.y0 - margin && b.y0 <= view.y1 + margin;
