import { XP_THRESHOLDS, levelForXp, nextLevelXp } from "./xp";

describe("levelForXp", () => {
  it("follows the 5e thresholds", () => {
    expect(XP_THRESHOLDS).toHaveLength(20);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(354999)).toBe(19);
    expect(levelForXp(355000)).toBe(20);
    expect(levelForXp(1e7)).toBe(20);
  });
  it("treats negative XP as level 1", () => expect(levelForXp(-50)).toBe(1));
  it("nextLevelXp is the next threshold, or undefined at level 20", () => {
    expect(nextLevelXp(900)).toBe(2700);
    expect(nextLevelXp(0)).toBe(300);
    expect(nextLevelXp(355000)).toBeUndefined();
  });
});
