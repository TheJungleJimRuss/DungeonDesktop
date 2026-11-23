import { defeatedMonsterXp, xpShare } from "./xpAward";
import type { Combatant } from "./rules";

const c = (o: Partial<Combatant>) => ({ id: "x", name: "x", kind: "monster", hp: 0, maxHp: 10, dexMod: 0, ...o }) as Combatant;
const xp = new Map([["gob", 50], ["owl", 700]]);

describe("xp award maths", () => {
  it("sums only defeated monsters with known XP", () => {
    const list = [c({ monsterId: "gob" }), c({ monsterId: "owl", hp: 5 }), c({ kind: "adhoc" }), c({ monsterId: "gob" }), c({ monsterId: "nope" })];
    expect(defeatedMonsterXp(list, xp)).toBe(100);
  });
  it("splits evenly, rounded down", () => {
    expect(xpShare(100, 3)).toBe(33);
    expect(xpShare(100, 0)).toBe(0);
    expect(xpShare(0, 2)).toBe(0);
  });
});
