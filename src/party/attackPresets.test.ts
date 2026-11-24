import { attackFromSpell, attackFromWeapon, buildAttackPresets, findAttackPresets } from "./attackPresets";
import { attackDamageText, attackToHitText } from "./sheet";
import type { EquipmentItem, Spell } from "../srd/reference";

const weapon = (over: Partial<EquipmentItem>): EquipmentItem =>
  ({ id: "w", name: "W", categories: ["Weapons", "Melee Weapons"], cost: "", properties: [], desc: "", ...over });
const spell = (over: Partial<Spell>): Spell =>
  ({ id: "s", name: "S", level: 0, school: "", classes: [], castingTime: "", ritual: false, range: "", components: "", duration: "", description: "", ...over });

const ctx = { level: 1, abilities: { str: 16, dex: 14, int: 18 }, spellcastingAbility: "int" as const };

describe("attack presets", () => {
  it("reads weapon dice, type and ability", () => {
    expect(attackFromWeapon(weapon({ name: "Battleaxe", damage: "1d8 Slashing (1d10 two-handed)" })))
      .toMatchObject({ name: "Battleaxe", ability: "str", count: 1, die: 8, type: "slashing", bonus: 0 });
    expect(attackFromWeapon(weapon({ name: "Rapier", damage: "1d8 Piercing", properties: ["Finesse"] }))?.ability).toBe("finesse");
    expect(attackFromWeapon(weapon({ name: "Longbow", damage: "1d8 Piercing", categories: ["Ranged Weapons"] }))?.ability).toBe("dex");
    expect(attackFromWeapon(weapon({ name: "Blowgun", damage: "1 Piercing" }))).toMatchObject({ count: 0, die: 0, bonus: 1 });
    expect(attackFromWeapon(weapon({ damage: undefined }))).toBeNull();
  });

  it("reads spell damage and keeps the spell modifier out of damage", () => {
    const a = attackFromSpell(spell({ name: "Fire Bolt", description: "Make a ranged spell attack. On a hit, the target takes 1d10 Fire damage." }))!;
    expect(a).toMatchObject({ ability: "spell", count: 1, die: 10, type: "fire" });
    expect(attackToHitText(a, ctx)).toBe("+6 to hit");
    expect(attackDamageText(a, ctx)).toBe("1d10 fire");
    expect(attackFromSpell(spell({ description: "You touch one object." }))).toBeNull();
  });

  it("lists weapons then spells and matches names by prefix first", () => {
    const presets = buildAttackPresets({
      equipment: [weapon({ id: "dagger", name: "Dagger", damage: "1d4 Piercing" }), weapon({ id: "rope", name: "Rope" })],
      spells: [spell({ id: "fb", name: "Fire Bolt", description: "takes 1d10 Fire damage" }), spell({ id: "light", name: "Light" })],
    });
    expect(presets.map((p) => p.name)).toEqual(["Dagger", "Fire Bolt"]);
    expect(presets[1].detail).toBe("Cantrip · 1d10 fire");
    expect(findAttackPresets(presets, "bolt").map((p) => p.name)).toEqual(["Fire Bolt"]);
    expect(findAttackPresets(presets, "d").map((p) => p.name)).toEqual(["Dagger"]);
    expect(findAttackPresets(presets, "  ")).toEqual([]);
  });
});
