import type { Square } from "./measure";
import { FEET_PER_SQUARE } from "../map/scale";

/** Walking speed in feet from text like "30 ft.", "30 ft., Fly 60 ft." or "Walk 25 ft."; null when none is given. */
export function walkSpeedFeet(text: string | undefined): number | null {
  const first = (text ?? "").split(",")[0];
  // A bare number ("30") counts as feet, as on a typed character sheet; any other unit ("30 m") does not.
  const m = /^\s*(?:walk\s*)?(\d+)\s*(?:(?:ft|feet)\b.*)?$/i.exec(first);
  return m ? Number(m[1]) : null;
}

/** The squares a creature can reach from `from` with `feet` of movement (2024 rule: every step costs one 5 ft square). The Map has no edge, so nothing is clipped. */
export function reachArea(from: Square, feet: number) {
  const n = Math.max(0, Math.floor(feet / FEET_PER_SQUARE));
  return { x: from.x - n, y: from.y - n, w: 2 * n + 1, h: 2 * n + 1, squares: n };
}
