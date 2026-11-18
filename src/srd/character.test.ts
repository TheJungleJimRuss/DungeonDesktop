import { describe, expect, it } from "vitest";
import { convertClass, convertClassFeature, convertClassLevels, convertSubclass, convertBackground, convertFeat, convertRule, convertSpeciesEntry, convertSubspecies, convertTrait } from "../../scripts/srd-convert.mjs";
import { loadCharacterData, setCharacterSource } from "./character";
import { FIXTURE_CHARACTER, FIXTURE_MONSTERS, FIXTURE_REFERENCE } from "./fixtures";
import { getReferenceEntry, loadSearchData, searchReference } from "./reference";
import { buildIndex, search } from "./search";
import type { Background, Feat } from "./character";

describe("conversion of character data", () => {
  it("converts a feat with its category, prerequisites and repeatability", () => {
    const f = convertFeat({ index: "grappler", name: "Grappler", type: "general", prerequisites: { minimum_level: 4 },
      prerequisite_options: { desc: "Strength or Dexterity 13+", choose: 1 }, description: "d", repeatable: "Once." }) as unknown as Feat;
    expect(f).toEqual({ id: "grappler", name: "Grappler", category: "General", description: "d", prerequisite: "Level 4+, Strength or Dexterity 13+", repeatable: "Once." });
    const a = convertFeat({ index: "alert", name: "Alert", type: "origin", description: "d" }) as unknown as Feat;
    expect(a).toEqual({ id: "alert", name: "Alert", category: "Origin", description: "d" });
    expect(convertFeat({ index: "archery", name: "Archery", type: "fighting-style", prerequisites: { feature_named: "Fighting Style" }, description: "d" })).toMatchObject({ category: "Fighting Style", prerequisite: "Fighting Style feature" });
  });
  it("flattens a background to ability names, a feat id, proficiencies and equipment text", () => {
    const b = convertBackground({
      index: "acolyte", name: "Acolyte", ability_scores: [{ name: "INT", url: "/x" }, { name: "WIS", url: "/y" }],
      feat: { index: "magic-initiate", name: "Magic Initiate", note: "Cleric", url: "/z" },
      proficiencies: [{ name: "Skill: Insight", url: "/a" }, { name: "Tool: Calligrapher's Supplies", url: "/b" }],
      proficiency_choices: [{ desc: "Choose one Gaming Set", from: { options: [{ item: { name: "Tool: Dice" } }] } }],
      equipment_options: [{ desc: "Choose A or B: (A) Robe; or (B) 50 GP", from: { options: [] } }],
    }) as unknown as Background;
    expect(b).toEqual({ id: "acolyte", name: "Acolyte", abilityScores: ["Intelligence", "Wisdom"], feat: { id: "magic-initiate", name: "Magic Initiate (Cleric)" },
      skills: ["Insight"], tools: ["Calligrapher's Supplies"], equipment: ["Choose A or B: (A) Robe; or (B) 50 GP"], proficiencyChoices: ["Choose one Gaming Set"] });
    expect(JSON.stringify(b)).not.toContain("/api");
  });
  it("converts each kind of rule", () => {
    expect(convertRule("skill", { index: "acrobatics", name: "Acrobatics", description: "d", ability_score: { name: "DEX" } })).toEqual({ id: "acrobatics", kind: "skill", name: "Acrobatics", desc: "d", ability: "Dexterity" });
    expect(convertRule("language", { index: "primordial", name: "Primordial", is_rare: true, note: "n" })).toEqual({ id: "primordial", kind: "language", name: "Primordial", desc: "", rare: true, note: "n" });
    expect(convertRule("language", { index: "common", name: "Common", is_rare: false, note: "" })).toEqual({ id: "common", kind: "language", name: "Common", desc: "", rare: false });
    expect(convertRule("alignment", { index: "lawful-good", name: "Lawful Good", abbreviation: "LG", description: "d" })).toMatchObject({ kind: "alignment", abbreviation: "LG" });
    expect(convertRule("ability-score", { index: "str", name: "STR", full_name: "Strength", description: "Might", skills: [{ name: "Athletics" }] }))
      .toEqual({ id: "str", kind: "ability-score", name: "Strength", abbreviation: "STR", desc: "Might", skills: ["Athletics"] });
    expect(convertRule("weapon-mastery", { index: "sap", name: "Sap", description: "d" })).toMatchObject({ kind: "weapon-mastery", name: "Sap" });
    expect(() => convertRule("nope", { index: "x", name: "X" })).toThrow();
  });
});

describe("conversion of species data", () => {
  const ref = (index: string, name: string) => ({ index, name, url: `/api/2024/x/${index}` });
  it("flattens a species, a size choice, a subspecies and a trait to ids and names", () => {
    expect(convertSpeciesEntry({ index: "elf", name: "Elf", type: "Humanoid", size: "Medium", speed: 30, traits: [ref("fey-ancestry", "Fey Ancestry")], subspecies: [ref("drow", "Drow")], url: "/u" }))
      .toEqual({ id: "elf", name: "Elf", type: "Humanoid", size: "Medium", speed: 30, traits: [{ id: "fey-ancestry", name: "Fey Ancestry" }], subspecies: [{ id: "drow", name: "Drow" }] });
    const sizes = { from: { options: [{ option_type: "size", size: "Small" }, { option_type: "size", size: "Medium" }] } };
    expect(convertSpeciesEntry({ index: "tiefling", name: "Tiefling", type: "Humanoid", speed: 30, size_options: sizes })).toMatchObject({ size: "Small or Medium", traits: [], subspecies: [] });
    expect(convertSubspecies({ index: "red", name: "Red", damage_type: ref("fire", "Fire"), species: ref("dragonborn", "Dragonborn"), traits: [{ ...ref("breath", "Breath"), level: 1 }] }))
      .toEqual({ id: "red", name: "Red", species: { id: "dragonborn", name: "Dragonborn" }, damageType: "Fire", traits: [{ id: "breath", name: "Breath" }] });
    expect(convertSubspecies({ index: "drow", name: "Drow", species: ref("elf", "Elf") })).toEqual({ id: "drow", name: "Drow", species: { id: "elf", name: "Elf" }, traits: [] });
    expect(convertTrait({ index: "t", name: "T", description: "d", species: [ref("elf", "Elf")], subspecies: [ref("drow", "Drow")], speed: 35, spells: [] }))
      .toEqual({ id: "t", name: "T", description: "d", species: [{ id: "elf", name: "Elf" }], subspecies: [{ id: "drow", name: "Drow" }] });
    expect(convertTrait({ index: "u", name: "U", description: "d", species: [ref("elf", "Elf")] })).not.toHaveProperty("subspecies");
  });
});

describe("character data loading", () => {
  it("serves the fixture through the test hook and includes it in the search data", async () => {
    setCharacterSource(async () => FIXTURE_CHARACTER);
    expect(await loadCharacterData()).toBe(FIXTURE_CHARACTER);
    expect((await loadSearchData()).feats).toBe(FIXTURE_CHARACTER.feats);
    expect(await getReferenceEntry("feat", "test-alert")).toMatchObject({ type: "feat" });
  });
  it("searches feats, backgrounds and rules, and can limit to one type or several", () => {
    const data = { monsters: FIXTURE_MONSTERS, ...FIXTURE_REFERENCE, ...FIXTURE_CHARACTER };
    const hits = (q: string, o = {}) => searchReference(data, q, o).map((h) => `${h.type}:${h.entry.name}`);
    expect(hits("alrt")[0]).toBe("feat:Alert Test");
    expect(hits("acolyt")[0]).toBe("background:Acolyte Test");
    expect(hits("test", { type: "rule" }).every((h) => h.startsWith("rule:"))).toBe(true);
    expect(hits("test", { type: ["feat", "background"] }).every((h) => /^(feat|background):/.test(h))).toBe(true);
  });
});

describe("bundled SRD character data", () => {
  it("is well formed, searchable by each entry's own name, and every background feat resolves", async () => {
    setCharacterSource(null);
    const c = await loadCharacterData();
    expect(c.feats).toHaveLength(17);
    expect(c.backgrounds).toHaveLength(4);
    expect(c.rules).toHaveLength(84);
    for (const [kind, n] of Object.entries({ skill: 18, language: 19, "damage-type": 13, "weapon-property": 10, "weapon-mastery": 8, alignment: 10, "ability-score": 6 })) {
      expect(c.rules.filter((r) => r.kind === kind), kind).toHaveLength(n);
    }
    for (const list of [c.feats, c.backgrounds, c.rules] as { id: string; name: string }[][]) {
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
      const idx = buildIndex(list);
      for (const x of list) {
        expect(x.name, x.id).toBeTruthy();
        expect(search(idx, x.name, 10).map((y) => y.id), x.name).toContain(x.id);
      }
    }
    const data = { monsters: FIXTURE_MONSTERS, ...FIXTURE_REFERENCE, ...c };
    for (const x of [...c.feats, ...c.backgrounds, ...c.rules]) {
      const type = "category" in x ? "feat" : "abilityScores" in x ? "background" : "rule";
      expect(searchReference(data, x.name, { type, limit: 10 }).map((h) => h.entry.id), x.name).toContain(x.id);
    }
    for (const f of c.feats) expect(f.description.length, f.name).toBeGreaterThan(10);
    for (const b of c.backgrounds) {
      expect(c.feats.map((f) => f.id), b.name).toContain(b.feat.id);
      expect(b.abilityScores.length && b.skills.length && b.equipment.length, b.name).toBeTruthy();
    }
    expect([c.species.length, c.subspecies.length, c.traits.length]).toEqual([9, 24, 67]);
    for (const list of [c.species, c.subspecies, c.traits] as { id: string; name: string }[][]) {
      const idx = buildIndex(list);
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
      for (const x of list) expect(search(idx, x.name, 10).map((y) => y.id), x.name).toContain(x.id);
    }
    const ids = (l: { id: string }[]) => new Set(l.map((x) => x.id));
    const [sp, ss, tr] = [ids(c.species), ids(c.subspecies), ids(c.traits)];
    for (const s of c.species) {
      expect(s.traits.length, s.name).toBeGreaterThan(0);
      for (const r of s.traits) expect(tr.has(r.id), `${s.id} -> ${r.id}`).toBe(true);
      for (const r of s.subspecies) { expect(ss.has(r.id), r.id).toBe(true); expect(c.subspecies.find((x) => x.id === r.id)?.species.id).toBe(s.id); }
    }
    for (const s of c.subspecies) {
      expect(sp.has(s.species.id), s.id).toBe(true);
      for (const r of s.traits) expect(tr.has(r.id), `${s.id} -> ${r.id}`).toBe(true);
    }
    for (const t of c.traits) {
      expect(t.description.length, t.name).toBeGreaterThan(5);
      expect(t.species.length + (t.subspecies?.length ?? 0), t.name).toBeGreaterThan(0);
      for (const r of t.species) expect(sp.has(r.id), `${t.id} -> ${r.id}`).toBe(true);
      for (const r of t.subspecies ?? []) expect(ss.has(r.id), `${t.id} -> ${r.id}`).toBe(true);
    }
    expect(c.species.find((s) => s.name === "Tiefling")?.size).toBe("Small or Medium");
    expect(c.rules.find((r) => r.name === "Acrobatics")?.ability).toBe("Dexterity");
    expect(c.rules.find((r) => r.name === "Primordial")).toMatchObject({ rare: true });
    expect(JSON.stringify(c)).not.toContain("/api/");
  });
});

const r = (index: string, name = index) => ({ index, name, url: "/api/x" });
const row = (cls: string, level: number, extra: object = {}) => ({ index: `${cls}-${level}`, level, prof_bonus: 2 + Math.floor((level - 1) / 4), features: [r(`${cls}-f${level}`)], class: r(cls), url: "/u", ...extra });

describe("conversion of class data", () => {
  it("flattens a class: hit die, ability names, proficiencies without saving throws, choice and multiclass text", () => {
    const c = convertClass({
      index: "fighter", name: "Fighter", hit_die: 10, primary_ability: { desc: "Strength or Dexterity", ability_scores: [r("str")] },
      proficiency_choices: [{ desc: "Choose 2: Athletics or History", choose: 2, from: { options: [] } }],
      proficiencies: [r("shields", "Shields"), r("saving-throw-str", "Saving Throw: STR")], saving_throws: [r("str", "STR"), r("con", "CON")],
      starting_equipment_options: [{ desc: "(a) Mace or (b) 5 GP", from: {} }], class_levels: "/api/x",
      multi_classing: { prerequisite_options: { from: { options: [{ ability_score: r("str", "STR"), minimum_score: 13 }, { ability_score: r("dex", "DEX"), minimum_score: 13 }] } }, proficiencies: [r("shields", "Shields")] },
      subclasses: [r("champion", "Champion")], url: "/u",
    });
    expect(c).toEqual({ id: "fighter", name: "Fighter", hitDie: 10, primaryAbility: "Strength or Dexterity", savingThrows: ["Strength", "Constitution"], proficiencies: ["Shields"],
      skillChoices: "Choose 2: Athletics or History", startingEquipment: "(a) Mace or (b) 5 GP", multiclass: "Prerequisite: Strength 13 or Dexterity 13. Proficiencies gained: Shields.",
      subclasses: [{ id: "champion", name: "Champion" }] });
    expect(JSON.stringify(c)).not.toContain("/api");
  });
  it("builds level columns from class_specific and spellcasting, drops all-empty columns, formats dice and dashes zeros", () => {
    const sc = (n: number, slot1: number, slot2: number) => ({ cantrips_known: 3, prepared_spells: n, spell_slots_level_1: slot1, spell_slots_level_2: slot2, spell_slots_level_3: 0 });
    const out = convertClassLevels([
      row("rogue", 2, { class_specific: { sneak_attack: { dice_count: 1, dice_value: 6 } } }),
      row("rogue", 1, { class_specific: { sneak_attack: { dice_count: 1, dice_value: 6 } } }),
      row("rogue", 3, { class_specific: { sneak_attack: { dice_count: 2, dice_value: 6 } } }),
      row("barb", 1, { class_specific: { rage_count: 2, rage_damage_bonus: 2, weapon_mastery: 2 } }),
      row("cleric", 1, { spellcasting: sc(4, 2, 0), class_specific: { channel_divinity_charges: 0 } }),
      row("cleric", 2, { spellcasting: sc(5, 3, 2), class_specific: { channel_divinity_charges: 2 } }),
      { ...row("barb", 3), subclass: r("berserker"), class_specific: { rage_count: 9 } },
    ]);
    const get = (id: string) => out.find((c) => c.id === id) as unknown as { levels: { level: number; profBonus: number; columns: Record<string, string | number>; featureIds: string[] }[] };
    expect(get("rogue").levels.map((l) => l.level)).toEqual([1, 2, 3]);
    expect(get("rogue").levels[2].columns).toEqual({ "Sneak Attack": "2d6" });
    expect(get("barb").levels).toHaveLength(1);
    expect(get("barb").levels[0]).toEqual({ level: 1, profBonus: 2, columns: { Rages: 2, "Rage Damage": "+2", "Weapon Mastery": 2 }, featureIds: ["barb-f1"] });
    const cl = get("cleric").levels;
    expect(Object.keys(cl[0].columns)).toEqual(["Channel Divinity", "Cantrips", "Prepared Spells", "1st", "2nd"]);
    expect(cl[0].columns).toMatchObject({ "Channel Divinity": "—", "2nd": "—", "1st": 2 });
    expect(cl[1].columns).toMatchObject({ "Channel Divinity": 2, "2nd": 2, "Prepared Spells": 5 });
    expect(cl[0].columns).not.toHaveProperty("3rd");
  });
  it("converts subclasses and puts a subclass feature under its subclass, with the level read from the level ref", () => {
    expect(convertSubclass({ index: "champion", name: "Champion", class: r("fighter", "Fighter"), summary: "Athletic", description: "d", features: [{ name: "x", level: 3, description: "y" }], url: "/u" }))
      .toEqual({ id: "champion", name: "Champion", class: { id: "fighter", name: "Fighter" }, summary: "Athletic", description: "d" });
    expect(convertClassFeature({ index: "champion-crit", name: "Improved Critical", class: r("fighter", "Fighter"), subclass: r("champion", "Champion"), level: r("fighter-3", "Fighter 3"), description: "It’s", url: "/u" }))
      .toEqual({ id: "champion-crit", name: "Improved Critical", class: { id: "fighter", name: "Fighter" }, subclass: { id: "champion", name: "Champion" }, level: 3, description: "It’s" });
    expect(convertClassFeature({ index: "fighter-action-surge", name: "Action Surge", class: r("fighter", "Fighter"), level: r("fighter-2", "Fighter 2"), description: "d" })).not.toHaveProperty("subclass");
    expect(convertClassFeature({ index: "a", name: "A", class: r("monk"), level: r("monk-20"), description: "artisanâ€™s" }).description).toBe("artisan’s");
  });
});

describe("bundled SRD class data", () => {
  it("has every class, subclass and feature, unique ids, resolvable refs, and each entry found by its own name", async () => {
    setCharacterSource(null);
    const c = await loadCharacterData();
    expect([c.classes.length, c.subclasses.length, c.classFeatures.length]).toEqual([12, 12, 232]);
    expect(c.classFeatures.filter((f) => f.subclass)).toHaveLength(58);
    for (const list of [c.classes, c.subclasses, c.classFeatures] as { id: string; name: string }[][]) expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    const [cls, sub, feat] = [new Set(c.classes.map((x) => x.id)), new Set(c.subclasses.map((x) => x.id)), new Set(c.classFeatures.map((x) => x.id))];
    for (const k of c.classes) {
      expect(k.levels, k.name).toHaveLength(20);
      for (const l of k.levels) for (const id of l.featureIds) { expect(feat.has(id), `${k.id} -> ${id}`).toBe(true); expect(c.classFeatures.find((f) => f.id === id)?.class.id).toBe(k.id); }
      for (const s of k.subclasses) { expect(sub.has(s.id), s.id).toBe(true); expect(c.subclasses.find((x) => x.id === s.id)?.class.id).toBe(k.id); }
      for (const l of k.levels) expect(Object.keys(l.columns), k.name).toEqual(Object.keys(k.levels[0].columns));
    }
    for (const s of c.subclasses) {
      expect(cls.has(s.class.id), s.id).toBe(true);
      expect(s.features.length, s.name).toBeGreaterThan(0);
      for (const f of s.features) expect(c.classFeatures.find((x) => x.id === f.id)?.subclass?.id).toBe(s.id);
    }
    for (const f of c.classFeatures) {
      expect(cls.has(f.class.id), f.id).toBe(true);
      if (f.subclass) expect(sub.has(f.subclass.id), f.id).toBe(true);
      expect(f.level).toBeGreaterThanOrEqual(1);
      expect(f.description.length, f.name).toBeGreaterThan(5);
    }
    // Feature names repeat across classes (e.g. 12 "Ability Score Improvement"): those are checked with a limit that fits every copy.
    const data = { monsters: FIXTURE_MONSTERS, ...FIXTURE_REFERENCE, ...c };
    const copies = (n: string) => c.classFeatures.filter((f) => f.name === n).length;
    for (const [type, list] of [["class", c.classes], ["subclass", c.subclasses], ["class-feature", c.classFeatures]] as const) {
      for (const x of list as { id: string; name: string }[]) {
        const limit = Math.max(10, copies(x.name) + 5);
        expect(searchReference(data, x.name, { type, limit }).map((h) => h.entry.id), x.name).toContain(x.id);
      }
    }
    const col = (id: string) => Object.keys(c.classes.find((k) => k.id === id)!.levels[0].columns);
    expect(col("barbarian")).toEqual(["Rages", "Rage Damage", "Weapon Mastery"]);
    expect(col("wizard")).toEqual(expect.arrayContaining(["Cantrips", "Prepared Spells", "1st", "9th"]));
    expect(col("wizard")).not.toContain("Rages");
    expect(col("barbarian")).not.toContain("1st");
    expect(c.classes.find((k) => k.id === "rogue")!.levels[4].columns["Sneak Attack"]).toBe("3d6");
    expect(JSON.stringify([c.classes, c.subclasses, c.classFeatures])).not.toMatch(/\/api\/|â€/);
  });
  it("searches all three class types for a short query within a few milliseconds", async () => {
    setCharacterSource(null);
    const data = await loadSearchData();
    searchReference(data, "ra"); // warm the per-list indexes
    const t0 = performance.now();
    const n = 20;
    for (let i = 0; i < n; i++) searchReference(data, ["rage", "ra", "fi", "sne"][i % 4]);
    const per = (performance.now() - t0) / n;
    console.log(`searchReference over all data: ${per.toFixed(2)} ms per query`);
    expect(per).toBeLessThan(50);
  });
});
