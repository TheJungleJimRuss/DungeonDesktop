/** Pure travel maths, 2024 rules: a day of travel is 8 hours. */
export type Pace = "slow" | "normal" | "fast";
export const PACES: Pace[] = ["slow", "normal", "fast"];

/** Miles covered per 8-hour day at each pace. */
export const MILES_PER_DAY: Record<Pace, number> = { slow: 18, normal: 24, fast: 30 };

/** Reminder shown next to each pace. */
export const PACE_REMINDERS: Record<Pace, string> = {
  slow: "Slow: 18 mi/day. Party can use Stealth.",
  normal: "Normal: 24 mi/day.",
  fast: "Fast: 30 mi/day. -5 to passive Wisdom (Perception).",
};

/** Terrain words that count as difficult terrain (speed halved). Matched case-insensitively as whole words. */
const DIFFICULT = ["difficult", "mountain", "mountains", "swamp", "marsh", "jungle", "forest", "snow", "ice", "rubble", "dense", "rough"];

/** Speed multiplier for a free-text terrain label. Empty or unknown terrain is ordinary (1). */
export function terrainMultiplier(terrain: string): number {
  const words = terrain.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return words.some((w) => DIFFICULT.includes(w)) ? 0.5 : 1;
}

/** Effective miles per day at a pace over the given terrain. */
export function milesPerDay(pace: Pace, terrain: string): number {
  return MILES_PER_DAY[pace] * terrainMultiplier(terrain);
}

/** Days (fractional, 2 decimals) to cover `miles`. Returns 0 for non-positive distances. */
export function travelDays(miles: number, pace: Pace, terrain: string): number {
  if (!(miles > 0)) return 0;
  return Math.round((miles / milesPerDay(pace, terrain)) * 100) / 100;
}

/** Human text: "3.5 days", "1 day", "under 1 day". */
export function formatDays(days: number): string {
  if (days <= 0) return "0 days";
  if (days < 1) return "under 1 day";
  const r = Math.round(days * 10) / 10;
  return `${r} ${r === 1 ? "day" : "days"}`;
}
