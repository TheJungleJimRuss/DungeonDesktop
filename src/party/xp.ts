/** 5e XP thresholds: entry i is the XP needed for level i + 1. */
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** Character level (1-20) for a total XP. Negative XP is level 1. */
export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) level = i + 1;
  return level;
}

/** XP needed for the next level, or undefined at level 20. */
export const nextLevelXp = (xp: number): number | undefined => XP_THRESHOLDS[levelForXp(xp)];
