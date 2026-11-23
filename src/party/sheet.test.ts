import { abilityMod, proficiencyBonus, saveBonus, skillBonus, SKILLS, spellAttackBonus, spellSaveDc, signed, DEFAULT_ABILITIES, asEquipment, countLabel, toCount, applyHpChange, adjustCoins, attackToHit, attackExpression, attackDamageText, attackToHitText, type Attack, type AttackContext } from "./sheet";

const ab = { ...DEFAULT_ABILITIES, dex: 16, wis: 8, int: 18 };

describe("character sheet maths", () => {
  it("derives modifiers and proficiency bonus", () => {
    expect([abilityMod(8), abilityMod(10), abilityMod(11), abilityMod(18)]).toEqual([-1, 0, 0, 4]);
    expect([1, 4, 5, 9, 13, 17, 20].map(proficiencyBonus)).toEqual([2, 2, 3, 4, 5, 6, 6]);
    expect([signed(3), signed(0), signed(-1)]).toEqual(["+3", "+0", "-1"]);
  });
  it("adds proficiency and expertise to saves and skills", () => {
    expect(saveBonus(ab, "dex", 5, true)).toBe(6);
    expect(saveBonus(ab, "dex", 5, false)).toBe(3);
    const stealth = SKILLS.find((s) => s.key === "stealth")!;
    expect(skillBonus(ab, stealth, 5, undefined)).toBe(3);
    expect(skillBonus(ab, stealth, 5, "proficient")).toBe(6);
    expect(skillBonus(ab, stealth, 5, "expertise")).toBe(9);
  });
  it("computes spell save DC and attack bonus", () => {
    expect(spellSaveDc(ab, "int", 5)).toBe(8 + 3 + 4);
    expect(spellAttackBonus(ab, "int", 5)).toBe(7);
  });
});

describe("equipment counts", () => {
  it("reads old string pack contents as single items", () => {
    const old = [{ name: "Explorer's Pack", contents: ["Torch", " "] }] as unknown as Parameters<typeof asEquipment>[0];
    expect(asEquipment(old)).toEqual([{ name: "Explorer's Pack", contents: [{ name: "Torch" }] }]);
  });
  it("labels counts above one", () => {
    expect(countLabel({ name: "Torch" })).toBe("Torch");
    expect(countLabel({ name: "Torch", quantity: 10 })).toBe("Torch ×10");
  });
  it("clamps counts to whole numbers of at least one", () => {
    expect([toCount(NaN), toCount(0), toCount(2.7), toCount(5)]).toEqual([1, 1, 2, 5]);
  });
});

import { asLanguages } from "../storage/party";
describe("asLanguages", () => {
  it("splits legacy comma or newline strings and keeps lists", () => {
    expect(asLanguages("Common, Elvish\nDwarvish")).toEqual(["Common", "Elvish", "Dwarvish"]);
    expect(asLanguages(["Common"])).toEqual(["Common"]);
    expect(asLanguages(undefined)).toEqual([]);
  });
});

describe("applyHpChange", () => {
  it("clamps between 0 and max", () => {
    expect(applyHpChange(10, 20, -4)).toBe(6);
    expect(applyHpChange(3, 20, -9)).toBe(0);
    expect(applyHpChange(18, 20, 5)).toBe(20);
  });
});

describe("adjustCoins", () => {
  it("adds and spends one kind of coin", () => {
    expect(adjustCoins(undefined, "gp", 25)).toEqual({ cp: 0, sp: 0, ep: 0, gp: 25, pp: 0 });
    expect(adjustCoins({ cp: 0, sp: 3, ep: 0, gp: 25, pp: 0 }, "gp", -5)?.gp).toBe(20);
  });
  it("refuses to spend more than the purse holds", () => {
    expect(adjustCoins({ cp: 0, sp: 0, ep: 0, gp: 4, pp: 0 }, "gp", -5)).toBeNull();
  });
});

describe("automatic attack to-hit and damage", () => {
  const base = { name: "Sword", count: 1, die: 8, bonus: 0, type: "slashing" };
  const ctx = (o: Partial<AttackContext> = {}): AttackContext => ({ level: 1, abilities: { ...DEFAULT_ABILITIES, str: 16, dex: 14 }, ...o });

  it("STR uses the strength mod plus proficiency, on to-hit and damage", () => {
    const a: Attack = { ...base, ability: "str" };
    expect(attackToHit(ctx(), a)).toBe(5);
    expect(attackExpression(a, ctx())).toBe("1d8+5");
  });
  it("DEX uses the dexterity mod", () => {
    expect(attackToHit(ctx(), { ...base, ability: "dex" })).toBe(4);
  });
  it("Finesse takes the better of STR and DEX", () => {
    expect(attackToHit(ctx(), { ...base, ability: "finesse" })).toBe(5);
    const dexy = ctx({ abilities: { ...DEFAULT_ABILITIES, str: 8, dex: 18 } });
    expect(attackToHit(dexy, { ...base, ability: "finesse" })).toBe(6);
    expect(attackExpression({ ...base, ability: "finesse" }, dexy)).toBe("1d8+6");
  });
  it("Spell uses the spellcasting ability, or 0 with none", () => {
    const c = ctx({ abilities: { ...DEFAULT_ABILITIES, int: 18 }, spellcastingAbility: "int" });
    expect(attackToHit(c, { ...base, ability: "spell" })).toBe(6);
    expect(attackToHit(ctx({ abilities: { ...DEFAULT_ABILITIES } }), { ...base, ability: "spell" })).toBe(2);
  });
  it("not proficient drops the proficiency bonus from to-hit and damage", () => {
    expect(attackToHit(ctx(), { ...base, ability: "str", proficient: false })).toBe(3);
    expect(attackExpression({ ...base, ability: "str", proficient: false }, ctx())).toBe("1d8+3");
  });
  it("magic adds to hit and damage, on top of the flat bonus", () => {
    const a: Attack = { ...base, ability: "str", magic: 1, bonus: 2 };
    expect(attackToHit(ctx(), a)).toBe(6);
    expect(attackExpression(a, ctx())).toBe("1d8+8");
    expect(attackDamageText(a, ctx())).toBe("1d8+8 slashing");
    expect(attackToHitText(a, ctx())).toBe("+6 to hit");
  });
  it("legacy attacks keep their stored numbers", () => {
    const a: Attack = { ...base, attackBonus: 7, bonus: 2 };
    expect(attackToHit(ctx(), a)).toBe(7);
    expect(attackExpression(a, ctx())).toBe("1d8+2");
    expect(attackToHitText(a)).toBe("+7 to hit");
    expect(attackToHit(ctx(), base)).toBeNull();
    expect(attackToHitText(base, ctx())).toBe("");
  });
  it("follows level changes", () => {
    const a: Attack = { ...base, ability: "str" };
    expect(attackToHit(ctx({ level: 5 }), a)).toBe(6);
    expect(attackExpression(a, ctx({ level: 5 }))).toBe("1d8+6");
    expect(attackToHit(ctx({ level: 9 }), a)).toBe(7);
  });
});
