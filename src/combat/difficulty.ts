/** Encounter difficulty by the 2024 DMG XP budget (per character, no group-size multiplier). */
export interface XpBudget { low: number; moderate: number; high: number }
export type DifficultyBand = "Below Low" | "Low" | "Moderate" | "High" | "Above High";

const TABLE: [number, number, number][] = [
  [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100],
  [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100],
  [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800],
  [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000],
];

/** Index by character level 1-20. */
export const XP_BUDGET: Record<number, XpBudget> =
  Object.fromEntries(TABLE.map(([low, moderate, high], i) => [i + 1, { low, moderate, high }]));

export interface Difficulty { total: number; budget: XpBudget; band: DifficultyBand }

const clampLevel = (l: number) => Math.min(20, Math.max(1, Math.round(l) || 1));

export function encounterDifficulty(levels: number[], monsterXp: number[]): Difficulty {
  const budget = levels.reduce<XpBudget>((acc, l) => {
    const b = XP_BUDGET[clampLevel(l)];
    return { low: acc.low + b.low, moderate: acc.moderate + b.moderate, high: acc.high + b.high };
  }, { low: 0, moderate: 0, high: 0 });
  const total = monsterXp.reduce((a, x) => a + x, 0);
  const band: DifficultyBand = total < budget.low ? "Below Low" : total < budget.moderate ? "Low"
    : total < budget.high ? "Moderate" : total === budget.high ? "High" : "Above High";
  return { total, budget, band };
}
