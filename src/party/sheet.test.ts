import { abilityMod, proficiencyBonus, saveBonus, skillBonus, SKILLS, spellAttackBonus, spellSaveDc, signed, DEFAULT_ABILITIES, asEquipment, countLabel, toCount, applyHpChange } from "./sheet";

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
