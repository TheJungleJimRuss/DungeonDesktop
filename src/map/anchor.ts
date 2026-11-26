import type { Pt } from "./geometry";

/** The SVG is drawn relative to an anchor near the view centre, so the browser's single-precision transforms never see huge numbers.
 *  Stored data and all maths stay in absolute world squares; only drawing and the pointer go through toLocal / toWorld. */

/** The view centre rounded to a coarse step: a power of two (at least 1) at least as wide as the view, in whole squares, so it changes rarely
 *  and adding or subtracting it is exact in double precision. */
export function anchorFor(centre: Pt, pxPerSquare: number, canvasWidthPx: number): Pt {
  const step = 2 ** Math.max(0, Math.ceil(Math.log2(Math.max(1, canvasWidthPx / pxPerSquare))));
  const r = (n: number) => Math.round(n / step) * step + 0; // + 0 turns -0 into 0
  return { x: r(centre.x), y: r(centre.y) };
}
/** A world point (squares) as drawn: relative to the anchor. */
export const toLocal = (p: Pt, a: Pt): Pt => ({ x: p.x - a.x, y: p.y - a.y });
/** A drawn point (squares relative to the anchor) back to the world. */
export const toWorld = (p: Pt, a: Pt): Pt => ({ x: p.x + a.x, y: p.y + a.y });
