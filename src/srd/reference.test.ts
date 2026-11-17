import { describe, expect, it } from "vitest";
import { convertCondition, convertEquipment, convertMagicItem, convertSpell } from "../../scripts/srd-convert.mjs";
import { buildIndex, search } from "./search";
import { FIXTURE_MONSTERS, FIXTURE_REFERENCE } from "./fixtures";
import { loadReference, searchReference, monsterFilterOptions, type Spell, type MagicItem, type EquipmentItem, type Condition } from "./reference";

describe("conversion of the other SRD types", () => {
  it("converts a spell", () => {
    const s = convertSpell({
      index: "fire-bolt", name: "Fire Bolt", level: 0, school: { name: "Evocation" }, classes: [{ name: "Sorcerer" }, { name: "Wizard" }],
      casting_time: "Action", ritual: false, range: "120 feet", components: ["V", "S", "M"], material: "a bit of wax", duration: "up to 1 minute",
      concentration: true, description: "Hurl fire.", higher_level: "More dice.",
    }) as unknown as Spell;
    expect(s).toMatchObject({ id: "fire-bolt", level: 0, school: "Evocation", classes: ["Sorcerer", "Wizard"], castingTime: "Action", range: "120 feet",
      components: "V, S, M (a bit of wax)", duration: "Concentration, up to 1 minute", description: "Hurl fire.", higherLevel: "More dice." });
    expect(s.ritual).toBe(false);
  });
  it("repairs components glued onto the range upstream", () => {
    const s = convertSpell({ index: "g", name: "G", level: 0, school: { name: "Enchantment" }, classes: [], casting_time: "Action", range: "Touch Component: V, S",
      components: [], duration: "1 round", description: "d" }) as unknown as Spell;
    expect(s).toMatchObject({ range: "Touch", components: "V, S" });
  });
  it("converts a magic item, an equipment item and a condition", () => {
    const m = convertMagicItem({ index: "x", name: "X", equipment_category: { name: "Weapons" }, rarity: { name: "Rare" }, attunement: true, "limited-to": "Paladin", desc: "d", variants: [{ name: "X, +1" }], variant: false }) as unknown as MagicItem;
    expect(m).toMatchObject({ id: "x", category: "Weapons", rarity: "Rare", attunement: "Requires attunement by a Paladin", desc: "d", variants: ["X, +1"] });
    const w = convertEquipment({ index: "axe", name: "Axe", equipment_categories: [{ name: "Weapons" }], cost: { quantity: 10, unit: "gp" }, weight: 4,
      damage: { damage_dice: "1d8", damage_type: { name: "Slashing" } }, two_handed_damage: { damage_dice: "1d10", damage_type: { name: "Slashing" } },
      properties: [{ name: "Versatile" }], mastery: { name: "Topple" }, range: { normal: 5 } }) as unknown as EquipmentItem;
    expect(w).toMatchObject({ id: "axe", cost: "10 gp", weight: 4, damage: "1d8 Slashing (1d10 two-handed)", properties: ["Versatile"], mastery: "Topple" });
    const a = convertEquipment({ index: "bp", name: "Breastplate", equipment_categories: [{ name: "Armor" }], cost: { quantity: 400, unit: "gp" }, weight: 20,
      armor_class: { base: 14, dex_bonus: true, max_bonus: 2 }, stealth_disadvantage: false, str_minimum: 0 }) as unknown as EquipmentItem;
    expect(a.armorClass).toBe("14 + Dex modifier (max 2)");
    const c = convertCondition({ index: "blinded", name: "Blinded", description: "You can't see." }) as unknown as Condition;
    expect(c).toEqual({ id: "blinded", name: "Blinded", desc: "You can't see." });
  });
});

describe("bundled SRD reference data", () => {
  it("has spells, magic items, equipment and conditions, each well formed and searchable by its own name", async () => {
    const ref = await loadReference();
    expect(ref.spells.length).toBeGreaterThan(300);
    expect(ref.magicItems.length).toBeGreaterThan(200);
    expect(ref.equipment.length).toBeGreaterThan(150);
    expect(ref.conditions.length).toBeGreaterThanOrEqual(14);
    for (const list of [ref.spells, ref.magicItems, ref.equipment, ref.conditions] as { id: string; name: string }[][]) {
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
      const idx = buildIndex(list);
      for (const x of list) {
        expect(x.name, x.id).toBeTruthy();
        expect(search(idx, x.name, 15).map((y) => y.id), x.name).toContain(x.id);
      }
    }
    for (const s of ref.spells) expect(s.description && s.castingTime && s.range && s.duration && s.components && s.school, s.name).toBeTruthy();
    expect(ref.conditions.every((c) => c.desc.length > 10)).toBe(true);
  });
  it("contains well-known entries with their rules text", async () => {
    const ref = await loadReference();
    expect(ref.spells.find((s) => s.name === "Fireball")).toMatchObject({ level: 3, school: "Evocation" });
    expect(ref.conditions.find((c) => c.name === "Blinded")?.desc).toMatch(/can't see/i);
    expect(ref.equipment.find((e) => e.name === "Longsword")?.damage).toMatch(/1d8/);
    expect(ref.magicItems.find((m) => m.name === "Bag of Holding")).toBeTruthy();
  });
});

describe("searchReference", () => {
  const ref = { monsters: FIXTURE_MONSTERS, ...FIXTURE_REFERENCE };
  const hits = (q: string, o = {}) => searchReference(ref, q, o).map((h) => `${h.type}:${h.entry.name}`);
  it("finds entries of every type, with typos and partial words", () => {
    expect(hits("fireb")[0]).toBe("spell:Fireball Test");
    expect(hits("firebal")).toContain("spell:Fireball Test");
    expect(hits("blind")[0]).toBe("condition:Blinded");
    expect(hits("longsord")[0]).toBe("equipment:Longsword Test");
    expect(hits("holdng")[0]).toBe("magic-item:Bag of Holding Test");
  });
  it("can be limited to one type, and returns nothing for an empty query", () => {
    expect(hits("test", { type: "spell" }).every((h) => h.startsWith("spell:"))).toBe(true);
    expect(hits("  ")).toEqual([]);
  });
  it("filters monsters by challenge rating and creature type", () => {
    expect(hits("", { type: "monster", cr: 0.25 })).toEqual(["monster:Goblin Warrior", "monster:Skeleton"]);
    expect(hits("", { type: "monster", creatureType: "undead" })).toEqual(["monster:Skeleton", "monster:Will-o’-Wisp"]);
    expect(hits("skel", { type: "monster", creatureType: "undead", cr: 0.25 })).toEqual(["monster:Skeleton"]);
    expect(hits("gob", { type: "monster", creatureType: "undead" })).toEqual([]);
    expect(monsterFilterOptions(FIXTURE_MONSTERS)).toEqual({ crs: [0.25, 2, 3, 22], types: ["dragon", "humanoid", "monstrosity", "undead"] });
  });
});
