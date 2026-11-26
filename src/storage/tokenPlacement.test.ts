import { newMapRecord, withCombatantTokens } from "./maps";

describe("Add tokens for all combatants", () => {
  it("puts the party down the left side and monsters down the right, apart", () => {
    const m = withCombatantTokens(newMapRecord("c", "m"), [
      { id: "p1", kind: "party", name: "Thia" }, { id: "g1", kind: "monster", name: "Goblin 1" },
      { id: "p2", kind: "party", name: "Brakka" }, { id: "g2", kind: "monster", name: "Goblin 2" },
      { id: "l", kind: "lair", name: "Lair actions" },
    ]);
    const at = (id: string) => { const t = m.tokens.find((x) => x.combatantId === id)!; return [t.x, t.y]; };
    expect(at("p1")).toEqual([1, 1]);
    expect(at("p2")).toEqual([1, 2]);
    expect(at("g1")).toEqual([7, 1]);
    expect(at("g2")).toEqual([7, 2]);
    expect(m.tokens).toHaveLength(4);
  });
  it("keeps a big fight inside a battle-scale view: columns of six below the spot, then the next column", () => {
    const party = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, kind: "party" as const, name: `P${i}` }));
    const m = withCombatantTokens(newMapRecord("c", "m"), party, { x: 100, y: 50 });
    expect(m.tokens.map((t) => [t.x, t.y])).toEqual([[101, 51], [101, 52], [101, 53], [101, 54], [101, 55], [101, 56], [102, 51], [102, 52]]);
  });
  it("never runs out of squares on an endless Map", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `m${i}`, kind: "monster" as const, name: `M${i}` }));
    const m = withCombatantTokens(newMapRecord("c", "m"), many);
    expect(new Set(m.tokens.map((t) => `${t.x},${t.y}`)).size).toBe(40);
  });
});
