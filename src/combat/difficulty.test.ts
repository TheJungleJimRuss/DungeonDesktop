import { XP_BUDGET, encounterDifficulty } from "./difficulty";

describe("XP_BUDGET", () => {
  it("has levels 1-20 with rising Low < Moderate < High", () => {
    for (let l = 1; l <= 20; l++) {
      const b = XP_BUDGET[l];
      expect(b.low).toBeLessThan(b.moderate);
      expect(b.moderate).toBeLessThan(b.high);
    }
    expect(XP_BUDGET[3]).toEqual({ low: 150, moderate: 225, high: 400 });
    expect(XP_BUDGET[20]).toEqual({ low: 6400, moderate: 13200, high: 22000 });
  });
});

describe("encounterDifficulty", () => {
  const at = (xp: number) => encounterDifficulty([3], [xp]).band;
  it("compares the total with the summed budget at each boundary", () => {
    expect(at(149)).toBe("Below Low");
    expect(at(150)).toBe("Low");
    expect(at(224)).toBe("Low");
    expect(at(225)).toBe("Moderate");
    expect(at(399)).toBe("Moderate");
    expect(at(400)).toBe("High");
    expect(at(401)).toBe("Above High");
  });
  it("sums monster XP and reports the budget", () => {
    expect(encounterDifficulty([3], [100, 200])).toEqual({ total: 300, budget: { low: 150, moderate: 225, high: 400 }, band: "Moderate" });
  });
  it("sums budgets across mixed levels", () => {
    const r = encounterDifficulty([1, 5], [0]);
    expect(r.budget).toEqual({ low: 550, moderate: 825, high: 1200 });
  });
  it("clamps levels below 1 and above 20", () => {
    expect(encounterDifficulty([0, -4], []).budget).toEqual({ low: 100, moderate: 150, high: 200 });
    expect(encounterDifficulty([25], []).budget).toEqual(XP_BUDGET[20]);
  });
  it("is Below Low with zero XP", () => {
    expect(encounterDifficulty([3], [])).toMatchObject({ total: 0, band: "Below Low" });
  });
});
