import { tokenLabel } from "./tokens";

describe("tokenLabel", () => {
  it("keeps numbered copies apart", () => {
    expect(tokenLabel("Goblin 1")).toBe("G1");
    expect(tokenLabel("Goblin 2")).toBe("G2");
    expect(tokenLabel("Goblin Warrior 2")).toBe("GW2");
  });
  it("uses two letters for a single name and initials for several words", () => {
    expect(tokenLabel("Thia")).toBe("TH");
    expect(tokenLabel("Bandit Captain")).toBe("BC");
    expect(tokenLabel("Lair actions (Dragon)")).toBe("LA");
  });
});
