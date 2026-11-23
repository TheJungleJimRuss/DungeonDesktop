import type { Square } from "./measure";

/** Walking speed in feet from text like "30 ft.", "30 ft., Fly 60 ft." or "Walk 25 ft."; null when none is given. */
export function walkSpeedFeet(text: string | undefined): number | null {
  const first = (text ?? "").split(",")[0];
  const m = /^\s*(?:walk\s*)?(\d+)\s*(?:ft|feet)\b/i.exec(first);
  return m ? Number(m[1]) : null;
}

/** The squares a creature can reach from `from` with `feet` of movement (2024 rule: every step costs one square), clipped to the map. */
export function reachArea(from: Square, feet: number, feetPerSquare: number, map: { width: number; height: number }) {
  const n = Math.max(0, Math.floor(feet / Math.max(1, feetPerSquare)));
  const x0 = Math.max(0, from.x - n), y0 = Math.max(0, from.y - n);
  const x1 = Math.min(map.width - 1, from.x + n), y1 = Math.min(map.height - 1, from.y + n);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, squares: n };
}
