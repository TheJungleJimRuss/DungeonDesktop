/** The scale bar: a round distance (1, 2 or 5 × a power of ten) whose on-screen length is as long as fits in `maxPx`.
 *  `pxPerUnit` is on-screen pixels per one unit of distance (ft or mi) at the current zoom. */
export function scaleBar(pxPerUnit: number, maxPx = 120): { amount: number; px: number } | null {
  if (!(pxPerUnit > 0) || !Number.isFinite(pxPerUnit)) return null;
  const raw = maxPx / pxPerUnit;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const amount = [5, 2, 1].map((m) => m * pow).find((a) => a <= raw * (1 + 1e-9))!;
  return { amount: +amount.toPrecision(12), px: amount * pxPerUnit };
}
