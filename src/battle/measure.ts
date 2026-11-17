export interface Square { x: number; y: number }

/** Squares between two squares: each step, diagonals included, costs one (2024 rule). */
export function distanceSquares(a: Square, b: Square): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function distanceFeet(a: Square, b: Square, feetPerSquare: number): number {
  return distanceSquares(a, b) * feetPerSquare;
}
