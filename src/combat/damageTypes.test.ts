import { adjustDamage, DAMAGE_TYPES, type Defenses } from "./damageTypes";

const d = (p: Partial<Defenses> = {}): Defenses => ({ resistances: [], immunities: [], vulnerabilities: [], ...p });

describe("adjustDamage", () => {
  it("lists the 13 types", () => {
    expect(DAMAGE_TYPES).toHaveLength(13);
    expect(DAMAGE_TYPES).toContain("Thunder");
  });
  it("leaves untyped damage and unlisted types unchanged", () => {
    expect(adjustDamage(10, undefined, d({ immunities: ["Poison"] }))).toEqual({ amount: 10 });
    expect(adjustDamage(10, "", d({ immunities: ["Poison"] }))).toEqual({ amount: 10 });
    expect(adjustDamage(10, "Fire", d({ immunities: ["Poison"] }))).toEqual({ amount: 10 });
  });
  it("immunity makes it 0", () => {
    expect(adjustDamage(10, "Poison", d({ immunities: ["Poison"] }))).toEqual({ amount: 0, reason: "Immune: poison (10 → 0)" });
  });
  it("resistance halves, rounding down", () => {
    expect(adjustDamage(10, "Fire", d({ resistances: ["Fire"] }))).toEqual({ amount: 5, reason: "Resistant: fire (10 → 5)" });
    expect(adjustDamage(7, "Fire", d({ resistances: ["Fire"] })).amount).toBe(3);
    expect(adjustDamage(1, "Fire", d({ resistances: ["Fire"] })).amount).toBe(0);
  });
  it("vulnerability doubles", () => {
    expect(adjustDamage(7, "Radiant", d({ vulnerabilities: ["Radiant"] }))).toEqual({ amount: 14, reason: "Vulnerable: radiant (7 → 14)" });
  });
  it("resistance and vulnerability together give floor(n/2) x 2", () => {
    const r = adjustDamage(7, "Fire", d({ resistances: ["Fire"], vulnerabilities: ["Fire"] }));
    expect(r.amount).toBe(6);
    expect(r.reason).toBe("Resistant + vulnerable: fire (7 → 6)");
  });
  it("immunity beats the others", () => {
    expect(adjustDamage(8, "Fire", d({ immunities: ["Fire"], vulnerabilities: ["Fire"] })).amount).toBe(0);
  });
  it("matches case-insensitively on the exact name only", () => {
    expect(adjustDamage(10, "fire", d({ resistances: ["FIRE"] })).amount).toBe(5);
    const q = d({ resistances: ["Piercing damage from weapons wielded by creatures under the effect of bless"] });
    expect(adjustDamage(10, "Piercing", q)).toEqual({ amount: 10 });
  });
});
