/** Pure 5e (2024) character-sheet maths and constants. No storage or UI here. */

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type AbilityKey = (typeof ABILITIES)[number];
export type Abilities = Record<AbilityKey, number>;

export const ABILITY_NAMES: Record<AbilityKey, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

export const DEFAULT_ABILITIES: Abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

export interface SkillDef { key: string; label: string; ability: AbilityKey }

export const SKILLS: SkillDef[] = [
  { key: "acrobatics", label: "Acrobatics", ability: "dex" },
  { key: "animalHandling", label: "Animal Handling", ability: "wis" },
  { key: "arcana", label: "Arcana", ability: "int" },
  { key: "athletics", label: "Athletics", ability: "str" },
  { key: "deception", label: "Deception", ability: "cha" },
  { key: "history", label: "History", ability: "int" },
  { key: "insight", label: "Insight", ability: "wis" },
  { key: "intimidation", label: "Intimidation", ability: "cha" },
  { key: "investigation", label: "Investigation", ability: "int" },
  { key: "medicine", label: "Medicine", ability: "wis" },
  { key: "nature", label: "Nature", ability: "int" },
  { key: "perception", label: "Perception", ability: "wis" },
  { key: "performance", label: "Performance", ability: "cha" },
  { key: "persuasion", label: "Persuasion", ability: "cha" },
  { key: "religion", label: "Religion", ability: "int" },
  { key: "sleightOfHand", label: "Sleight of Hand", ability: "dex" },
  { key: "stealth", label: "Stealth", ability: "dex" },
  { key: "survival", label: "Survival", ability: "wis" },
];

export type SkillLevel = "proficient" | "expertise";
export type SkillProficiencies = Record<string, SkillLevel | undefined>;

/** Current HP after a change (negative = damage), kept between 0 and max. */
export const applyHpChange = (current: number, max: number, delta: number) => Math.max(0, Math.min(max, current + delta));

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

export const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);

/** "+3" / "-1" / "+0". */
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export const saveBonus = (abilities: Abilities, key: AbilityKey, level: number, proficient: boolean) =>
  abilityMod(abilities[key]) + (proficient ? proficiencyBonus(level) : 0);

export function skillBonus(abilities: Abilities, skill: SkillDef, level: number, prof: SkillLevel | undefined) {
  const pb = proficiencyBonus(level);
  return abilityMod(abilities[skill.ability]) + (prof === "expertise" ? pb * 2 : prof === "proficient" ? pb : 0);
}

export const spellSaveDc = (abilities: Abilities, key: AbilityKey, level: number) =>
  8 + proficiencyBonus(level) + abilityMod(abilities[key]);

export const spellAttackBonus = (abilities: Abilities, key: AbilityKey, level: number) =>
  proficiencyBonus(level) + abilityMod(abilities[key]);

export const CURRENCIES = ["cp", "sp", "ep", "gp", "pp"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type Coins = Record<Currency, number>;
export const NO_COINS: Coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

export const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
] as const;
export const DAMAGE_DICE = [4, 6, 8, 10, 12] as const;

export interface Attack {
  name: string;
  /** How many of this weapon the character carries; absent = 1. */
  quantity?: number;
  /** Number of damage dice. */
  count: number;
  /** Sides on each die; 0 = no dice (flat damage only). */
  die: number;
  /** Flat damage bonus (may be negative). */
  bonus: number;
  type: string;
}

/** Dice expression for the roller, e.g. "2d6+3"; null when the attack has no damage. */
export function attackExpression(a: Attack): string | null {
  const dice = a.count > 0 && a.die > 0 ? `${a.count}d${a.die}` : "";
  if (!dice) return a.bonus ? String(Math.max(0, a.bonus)) : null;
  return a.bonus ? `${dice}${a.bonus > 0 ? "+" : "-"}${Math.abs(a.bonus)}` : dice;
}

/** "Dagger" or "Dagger ×3". */
export const attackLabel = (a: Attack) => countLabel(a);

/** "2d6+3 slashing", or "—" with no damage. */
export function attackDamageText(a: Attack): string {
  const e = attackExpression(a);
  return e ? `${e}${a.type ? ` ${a.type}` : ""}` : "—";
}

/** Reads an attack list, tolerating the earlier string-list and text formats. */
export function asAttacks(v: (Attack | string)[] | string | undefined): Attack[] {
  const raw = Array.isArray(v) ? v : (v ?? "").split("\n");
  return raw
    .map((x) => (typeof x === "string" ? { name: x.trim(), count: 0, die: 0, bonus: 0, type: "" } : x))
    .filter((a) => a.name);
}

/** An item inside a pack. */
export interface PackItem {
  name: string;
  /** How many; absent = 1. */
  quantity?: number;
}

/** An equipment entry: a single item, or a pack holding several items. */
export interface EquipmentEntry {
  name: string;
  /** How many; absent = 1. */
  quantity?: number;
  /** Present on packs (even when empty); absent on single items. */
  contents?: PackItem[];
}

export const isPack = (e: EquipmentEntry) => Array.isArray(e.contents);

/** "Torch" or "Torch ×10". */
export const countLabel = (e: { name: string; quantity?: number }) => ((e.quantity ?? 1) > 1 ? `${e.name} ×${e.quantity}` : e.name);

/** A whole-number count of at least 1; anything else becomes 1. */
export const toCount = (n: number) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);

const asPackItem = (x: PackItem | string): PackItem => (typeof x === "string" ? { name: x.trim() } : x);

/** Reads an equipment list, tolerating the earlier string-list and text formats and string pack contents. */
export function asEquipment(v: (EquipmentEntry | string)[] | string | undefined): EquipmentEntry[] {
  const raw = Array.isArray(v) ? v : (v ?? "").split("\n");
  return raw
    .map((x): EquipmentEntry => {
      if (typeof x === "string") return { name: x.trim() };
      if (!Array.isArray(x.contents)) return x;
      return { ...x, contents: (x.contents as (PackItem | string)[]).map(asPackItem).filter((c) => c.name) };
    })
    .filter((e) => e.name);
}
