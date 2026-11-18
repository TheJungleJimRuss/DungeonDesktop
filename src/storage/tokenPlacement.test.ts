import { defaultMap, withCombatantTokens } from "./battleMaps";

describe("Add tokens for all combatants", () => {
  it("puts the party down the left side and monsters down the right, apart", () => {
    const m = withCombatantTokens(defaultMap("c", "e"), [
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
  it("still finds a square on a tiny map", () => {
    const m = withCombatantTokens({ ...defaultMap("c", "e"), width: 1, height: 2 }, [
      { id: "a", kind: "party", name: "A" }, { id: "b", kind: "monster", name: "B" },
    ]);
    expect(m.tokens.map((t) => [t.x, t.y])).toEqual([[0, 0], [0, 1]]);
  });
});
