import { applyAuto, autoMaxHp, computeAuto } from "./autoSheet";
import { FIXTURE_CHARACTER } from "../srd/fixtures";
import type { CharacterData, Class } from "../srd/character";
import type { PartyMember } from "../storage/party";

const base: PartyMember = { id: "m1", campaignId: "c", name: "Mira", class: "", level: 1, ac: 10, maxHp: 1, passivePerception: 10, notes: "" };
const srd = FIXTURE_CHARACTER;
const withAbilities = (con: number) => ({ str: 10, dex: 10, con, int: 10, wis: 10, cha: 10 });

/** A Fighter and a Warlock built on the fixture shape. */
const fighter: Class = { id: "fighter", name: "Fighter", hitDie: 10, primaryAbility: "Strength", savingThrows: ["Strength", "Constitution"], proficiencies: ["All Armor", "Martial Weapons"],
  skillChoices: "", startingEquipment: "", multiclass: "", subclasses: [],
  levels: [{ level: 1, profBonus: 2, columns: { "Second Wind": 2 }, featureIds: ["second-wind"] }] };
const warlock: Class = { id: "warlock", name: "Warlock", hitDie: 8, primaryAbility: "Charisma", savingThrows: ["Wisdom", "Charisma"], proficiencies: ["Light Armor"],
  skillChoices: "", startingEquipment: "", multiclass: "", subclasses: [],
  levels: [
    { level: 1, profBonus: 2, columns: { "1st": 1, "2nd": "—" }, featureIds: [] },
    { level: 2, profBonus: 2, columns: { "1st": 2, "2nd": "—" }, featureIds: [] },
    { level: 3, profBonus: 2, columns: { "1st": "—", "2nd": 2, "3rd": "—" }, featureIds: ["pact"] },
  ] };
const data: CharacterData = { ...srd, classes: [...srd.classes, fighter, warlock],
  classFeatures: [...srd.classFeatures, { id: "second-wind", name: "Second Wind", class: { id: "fighter", name: "Fighter" }, level: 1, description: "" },
    { id: "pact", name: "Pact Magic", class: { id: "warlock", name: "Warlock" }, level: 3, description: "" }] };

describe("autoMaxHp", () => {
  it("level 1 is die max + CON, later levels die average + CON, min 1 per level", () => {
    expect(autoMaxHp(8, 1, 14)).toBe(10);
    expect(autoMaxHp(8, 3, 14)).toBe(10 + 7 + 7);
    expect(autoMaxHp(6, 1, 10)).toBe(6);
    expect(autoMaxHp(12, 2, 10)).toBe(12 + 7);
    expect(autoMaxHp(6, 3, 1)).toBe(1 + 1 + 1); // CON -5 never drops a level below 1
  });
});

describe("computeAuto / applyAuto", () => {
  it("Wizard-like caster at level 5: saves, hit dice, HP, casting ability, slots, features", () => {
    const m = applyAuto({ ...base, class: "Mage Test", classId: "test-mage", level: 5, abilities: withAbilities(14) }, srd);
    expect(m.saveProficiencies).toEqual(["int", "wis"]);
    expect(m.hitDice).toBe("5d6");
    expect(m.maxHp).toBe(6 + 2 + 4 * (4 + 2));
    expect(m.spellcastingAbility).toBe("int");
    expect(m.spellSlotsMax).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(m.autoFeatures).toEqual(["Casting Test", "Recovery Test", "Mage Fire Test"]);
    expect(m.autoProficiencies).toEqual(["Daggers"]);
  });

  it("Fighter at level 1: martial, no slots and no spellcasting ability", () => {
    const m = applyAuto({ ...base, class: "Fighter", classId: "fighter", abilities: withAbilities(12) }, data);
    expect(m.hitDice).toBe("1d10");
    expect(m.maxHp).toBe(11);
    expect(m.saveProficiencies).toEqual(["str", "con"]);
    expect(m.spellcastingAbility).toBeUndefined();
    expect(m.spellSlotsMax).toEqual([]);
    expect(m.autoFeatures).toEqual(["Second Wind"]);
  });

  it("Warlock 3: pact slots come from the level table, ability is CHA by name", () => {
    const m = applyAuto({ ...base, class: "Warlock", classId: "warlock", level: 3 }, data);
    expect(m.spellcastingAbility).toBe("cha");
    expect(m.spellSlotsMax).toEqual([0, 2, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("custom class (no classId) leaves class-driven fields alone, but species speed still applies", () => {
    const m = applyAuto({ ...base, class: "Hexblade", level: 4, maxHp: 33, hitDice: "4d8", saveProficiencies: ["wis"], spellSlotsMax: [3], speciesId: "test-drake" }, srd);
    expect(m).toMatchObject({ maxHp: 33, hitDice: "4d8", saveProficiencies: ["wis"], spellSlotsMax: [3], speed: "30 ft." });
    expect(applyAuto({ ...base, speed: "40 ft." }, srd).speed).toBe("40 ft.");
  });

  it("species supplies speed and traits; background supplies feat and tool", () => {
    const m = applyAuto({ ...base, speciesId: "test-sprite", backgroundId: "test-acolyte" }, srd);
    expect(m.speed).toBe("25 ft.");
    expect(m.autoFeatures).toEqual(["Alert Test (Cleric)", "Darksight Test"]);
    expect(m.autoProficiencies).toEqual(["Calligrapher's Supplies"]);
  });

  it("a manual field is kept, others still follow", () => {
    const m = applyAuto({ ...base, class: "Mage Test", classId: "test-mage", level: 2, maxHp: 99, manual: { maxHp: true } }, srd);
    expect(m.maxHp).toBe(99);
    expect(m.hitDice).toBe("2d6");
    expect(computeAuto({ ...base, classId: "test-mage" }, srd).maxHp).toBe(6);
  });

  it("background skills become proficient without downgrading expertise", () => {
    const m = applyAuto({ ...base, backgroundId: "test-acolyte", skills: { insight: "expertise", stealth: "proficient" } }, srd);
    expect(m.skills).toEqual({ insight: "expertise", stealth: "proficient", religion: "proficient" });
  });

  it("hand-added features and proficiencies survive a level change; generated ones regenerate", () => {
    const l1 = applyAuto({ ...base, class: "Mage Test", classId: "test-mage", features: ["Lucky"], proficiencies: ["Lute"] }, srd);
    expect(l1.autoFeatures).toEqual(["Casting Test"]);
    const l5 = applyAuto({ ...l1, level: 5 }, srd);
    expect(l5.autoFeatures).toEqual(["Casting Test", "Recovery Test", "Mage Fire Test"]);
    expect(l5.features).toEqual(["Lucky"]);
    expect(l5.proficiencies).toEqual(["Lute"]);
  });

  it("level up adds the HP gained to current HP; slots used are capped", () => {
    const m = applyAuto({ ...base, class: "Mage Test", classId: "test-mage", level: 2, maxHp: 10, currentHp: 4, spellSlotsMax: [3], spellSlotsUsed: [3] }, srd);
    expect(m.maxHp).toBe(10);
    expect(m.spellSlotsUsed?.[0]).toBe(3);
    const l1 = applyAuto({ ...base, class: "Mage Test", classId: "test-mage", level: 1, maxHp: 6, currentHp: 2, spellSlotsMax: [2], spellSlotsUsed: [2] }, srd);
    const up = applyAuto({ ...l1, level: 2 }, srd);
    expect(up.maxHp).toBe(10);
    expect(up.currentHp).toBe(6);
    expect(up.spellSlotsUsed).toEqual([2]);
  });
});

describe("level from XP", () => {
  const mage = { ...base, class: "Mage Test", classId: "test-mage", abilities: withAbilities(10) };
  it("auto level follows XP, and HP, slots and hit dice follow the new level", () => {
    const m = applyAuto({ ...mage, level: 1, xp: 900 }, srd);
    expect(m.level).toBe(3);
    expect(m.hitDice).toBe("3d6");
    expect(m.maxHp).toBe(6 + 2 * 4);
    expect(m.spellSlotsMax?.slice(0, 2)).toEqual([4, 2]);
    expect(computeAuto({ ...mage, level: 1, xp: 900 }, srd).level).toBe(3);
  });
  it("a manual level is kept and the other fields follow it", () => {
    const m = applyAuto({ ...mage, level: 2, xp: 900, manual: { level: true } }, srd);
    expect(m.level).toBe(2);
    expect(m.hitDice).toBe("2d6");
  });
  it("no XP (absent or NaN) keeps the typed level", () => {
    expect(applyAuto({ ...mage, level: 4 }, srd).level).toBe(4);
    expect(applyAuto({ ...mage, level: 4, xp: NaN }, srd).level).toBe(4);
    expect("level" in computeAuto({ ...mage, level: 4 }, srd)).toBe(false);
  });
});
