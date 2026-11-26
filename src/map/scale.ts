export const FEET_PER_MILE = 5280;
/** A Map in feet reads in miles once a distance reaches this many feet (1000 ft = 0.19 mi). */
export const MILES_FROM_FEET = 1000;

/** The scale bar: a round distance (1, 2 or 5 × a power of ten) whose on-screen length is as long as fits in `maxPx`.
 *  `pxPerUnit` is on-screen pixels per one unit of distance (ft or mi) at the current zoom. */
export function scaleBar(pxPerUnit: number, maxPx = 120): { amount: number; px: number } | null {
  if (!(pxPerUnit > 0) || !Number.isFinite(pxPerUnit)) return null;
  const raw = maxPx / pxPerUnit;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const amount = [5, 2, 1].map((m) => m * pow).find((a) => a <= raw * (1 + 1e-9))!;
  return { amount: +amount.toPrecision(12), px: amount * pxPerUnit };
}

/** A Map's world coordinates are base squares of exactly this many feet (ADR 0003). */
export const FEET_PER_SQUARE = 5;
/** Battle scale: on-screen pixels per base square, about one Token's size at the old fit view. New Maps open here, and an empty Map's "Fit all" returns here. */
export const BATTLE_PX_PER_SQUARE = 32;
/** The zoom limits, in pixels per base square: one square is 1/10,000,000 px (about 47,000 mi across a 1,000 px view) up to 1,000 px (one square fills the view). */
export const MIN_PX_PER_SQUARE = 1e-7, MAX_PX_PER_SQUARE = 1000;
export const clampPxPerSquare = (px: number) => (Number.isFinite(px) && px > 0 ? Math.min(MAX_PX_PER_SQUARE, Math.max(MIN_PX_PER_SQUARE, px)) : BATTLE_PX_PER_SQUARE);
/** The view a new Map opens at: battle scale, centred on (0, 0). */
export const battleView = (): { centre: { x: number; y: number }; pxPerSquare: number } => ({ centre: { x: 0, y: 0 }, pxPerSquare: BATTLE_PX_PER_SQUARE });

/** Distance in feet or miles from a count of base squares: ft below 1,000 ft, mi from there ("25 ft", "7.5 ft", "3.2 mi"; two decimals at most). */
export function formatSquares(squares: number): string {
  const ft = squares * FEET_PER_SQUARE;
  return Math.abs(ft) >= MILES_FROM_FEET ? `${+(ft / FEET_PER_MILE).toFixed(2)} mi` : `${+ft.toFixed(2)} ft`;
}

/** The grid ladder in feet: the 1, 2, 5 series, but never finer than the 5 ft base square (2.5 ft and below are not wanted), up to 500 ft;
 *  then miles (1, 2, 5, 10, 20 ... mi). 500 ft to 1 mi (5,280 ft) is one rung. */
function ladderStep(i: number): number {
  const ft = [5, 10, 20, 50, 100, 200, 500];
  if (i < ft.length) return ft[i];
  const j = i - ft.length;
  return +([1, 2, 5][j % 3] * 10 ** Math.floor(j / 3) * FEET_PER_MILE).toPrecision(12);
}
export interface GridLadder {
  /** Two neighbouring steps in feet (lo < hi) and their crossfade weights (sum 1; the weights follow log position between them). */
  lo: number; hi: number; wLo: number; wHi: number;
  /** The step with the higher weight: the label, scale bar and snapping follow it. */
  dominant: number;
}
/** The grid at this zoom. The ideal grid square is `targetPx` on screen (default a battle square), i.e. FEET_PER_SQUARE * targetPx / pxPerSquare feet;
 *  it sits between two ladder steps, and the weights crossfade them by log position so the grid never jumps. Zoomed in past 5 ft it stays at 5 ft. */
export function gridLadder(pxPerSquare: number, targetPx = BATTLE_PX_PER_SQUARE): GridLadder {
  const ideal = Math.max(FEET_PER_SQUARE, (FEET_PER_SQUARE * targetPx) / clampPxPerSquare(pxPerSquare));
  let i = 0;
  while (ladderStep(i + 1) <= ideal * (1 + 1e-12)) i++;
  const lo = ladderStep(i), hi = ladderStep(i + 1);
  const wHi = Math.min(1, Math.max(0, Math.log(ideal / lo) / Math.log(hi / lo)));
  return { lo, hi, wLo: 1 - wHi, wHi, dominant: wHi > 0.5 ? hi : lo };
}

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
/** The box (in squares) around every Line point, Marker, Token (a whole square) and the Party Token; null when nothing is drawn. */
export function mapBounds(m: { lines: { points: { x: number; y: number }[] }[]; markers: { x: number; y: number }[]; tokens: { x: number; y: number }[]; partyToken?: { x: number; y: number } }): Bounds | null {
  const pts: { x: number; y: number }[] = [...m.lines.flatMap((l) => l.points), ...m.markers];
  const squares = [...m.tokens, ...(m.partyToken ? [m.partyToken] : [])];
  if (!pts.length && !squares.length) return null;
  const xs = [...pts.map((p) => p.x), ...squares.flatMap((p) => [p.x, p.x + 1])], ys = [...pts.map((p) => p.y), ...squares.flatMap((p) => [p.y, p.y + 1])];
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
/** "Fit all": a view that shows `bounds` with padding in a canvas of `size` pixels, never closer than battle scale. With nothing drawn, battle scale at (0, 0). */
export function fitView(bounds: Bounds | null, size: { w: number; h: number }, pad = 0.1): { centre: { x: number; y: number }; pxPerSquare: number } {
  if (!bounds) return battleView();
  const w = Math.max(bounds.maxX - bounds.minX, 1) * (1 + 2 * pad), h = Math.max(bounds.maxY - bounds.minY, 1) * (1 + 2 * pad);
  const px = Math.min(size.w / w, size.h / h, BATTLE_PX_PER_SQUARE);
  return { centre: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, pxPerSquare: clampPxPerSquare(px) };
}
