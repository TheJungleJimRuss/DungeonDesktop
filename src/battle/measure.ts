export interface Square { x: number; y: number }

/** Squares between two squares: each step, diagonals included, costs one (2024 rule). */
export function distanceSquares(a: Square, b: Square): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Distance in the Map's unit: squares times what one square is worth. */
export function distanceUnits(a: Square, b: Square, perSquare: number): number {
  return distanceSquares(a, b) * perSquare;
}
/** "25 ft", "7.5 ft", "30 mi" (rounded to two decimals so 0.1 x 3 reads 0.3). */
export function formatDistance(amount: number, unit: string): string {
  return `${+amount.toFixed(2)} ${unit}`;
}
