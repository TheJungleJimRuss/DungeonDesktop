import { describe, expect, it } from "vitest";
import { buildIndex, search } from "./search";
import { FIXTURE_MONSTERS } from "./fixtures";
import { loadMonsters, type Monster } from "./monsters";
import { convertMonster } from "../../scripts/srd-convert.mjs";

const idx = buildIndex(FIXTURE_MONSTERS);
const names = (q: string) => search(idx, q).map((m) => m.name);

describe("monster search (fixture data)", () => {
  it("finds by partial word, any case", () => {
    expect(names("gob")[0]).toBe("Goblin Warrior");
    expect(names("OWL")).toEqual(["Owlbear"]);
  });
  it("tolerates typos, swapped letters and missing letters", () => {
    expect(names("gobln")[0]).toBe("Goblin Warrior");
    expect(names("skelton")[0]).toBe("Skeleton");
    expect(names("skelteon")[0]).toBe("Skeleton");
    expect(names("owlbaer")[0]).toBe("Owlbear");
  });
  it("matches each word of the query, ignoring punctuation and accents", () => {
    expect(names("warrior goblin")[0]).toBe("Goblin Warrior");
    expect(names("will o wisp")[0]).toBe("Will-o’-Wisp");
    expect(names("wyrm test")[0]).toBe("Ancient Test Wyrm");
  });
  it("ranks exact and prefix matches first and ignores unrelated or empty queries", () => {
    expect(names("skeleton")[0]).toBe("Skeleton");
    expect(names("zzzzqq")).toEqual([]);
    expect(names("  ")).toEqual([]);
  });
});

describe("conversion", () => {
  it("maps an upstream record to the app shape", () => {
    const m = convertMonster({
      index: "x", name: "X", size: "Large", type: "dragon", alignment: "neutral", armor_class: [{ value: 18, armor: [{ name: "Natural Armor" }] }],
      hit_points: 10, hit_points_roll: "1d8", speed: { walk: "30 ft.", fly: "60 ft.", hover: true }, strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10, proficiencies: [{ proficiency: { name: "Saving Throw: DEX" }, value: 3 }, { proficiency: { name: "Skill: Stealth" }, value: -1 }],
      damage_resistances: ["fire"], condition_immunities: [{ name: "Charmed" }], senses: { darkvision: "60 ft.", passive_perception: 12 }, languages: "",
      challenge_rating: 0.5, xp: 100, xp_in_lair: 200, proficiency_bonus: 2,
      actions: [{ name: "Breath", desc: "d", usage: { type: "recharge on roll", min_value: 5 } }], legendary_actions: [{ name: "Lash", desc: "l" }],
    }) as unknown as Monster;
    expect(m).toMatchObject({ id: "x", ac: 18, acNote: "Natural Armor", speed: "30 ft., Fly 60 ft. (hover)", saves: ["DEX +3"], skills: ["Stealth -1"],
      resistances: ["Fire"], conditionImmunities: ["Charmed"], senses: "Darkvision 60 ft., Passive Perception 12", languages: "None", xpInLair: 200, legendaryUses: 3 });
    expect(m.actions[0].name).toBe("Breath (Recharge 5-6)");
  });
});

describe("bundled SRD monster data", () => {
  it("parses, is well formed, and every entry is searchable by its own name", async () => {
    const all = await loadMonsters();
    expect(all.length).toBeGreaterThan(300);
    expect(new Set(all.map((m) => m.id)).size).toBe(all.length);
    for (const m of all) {
      expect(m.name, m.id).toBeTruthy();
      expect(Number.isFinite(m.ac) && Number.isFinite(m.hp) && Number.isFinite(m.cr) && Number.isFinite(m.xp), m.name).toBe(true);
      expect(Object.values(m.abilities).every((n) => Number.isInteger(n)), m.name).toBe(true);
      for (const e of [...m.traits, ...m.actions, ...m.bonusActions, ...m.reactions, ...m.legendaryActions]) expect(e.name && e.desc, m.name).toBeTruthy();
    }
    const index = buildIndex(all);
    for (const m of all) expect(search(index, m.name, 10).map((x) => x.id), m.name).toContain(m.id);
  });
  it("contains well-known SRD creatures and legendary stat blocks", async () => {
    const all = await loadMonsters();
    expect(all.find((m) => m.name === "Goblin Warrior")).toBeTruthy();
    expect(all.find((m) => m.name === "Aboleth")?.legendaryActions.length).toBeGreaterThan(0);
  });
});
