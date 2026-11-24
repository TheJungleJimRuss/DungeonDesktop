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

/** Adds (delta > 0) or spends (delta < 0) whole coins of one kind. Returns null when the purse lacks the coins. */
export function adjustCoins(coins: Partial<Coins> | undefined, currency: Currency, delta: number): Coins | null {
  const purse = { ...NO_COINS, ...coins };
  const next = purse[currency] + Math.trunc(delta);
  if (next < 0) return null;
  return { ...purse, [currency]: next };
}

export const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
] as const;
export const DAMAGE_DICE = [4, 6, 8, 10, 12] as const;

/** "none" = no ability modifier (to-hit is proficiency + magic only). */
export type AttackAbility = "str" | "dex" | "finesse" | "spell" | "none";

export interface Attack {
  name: string;
  /** Ability the attack uses; absent = legacy attack that keeps its typed attackBonus and bonus. */
  ability?: AttackAbility;
  /** Add proficiency bonus to hit; absent = true when ability is set. */
  proficient?: boolean;
  /** Add the ability modifier to damage; absent = true. Spells from the SRD search set it false. */
  abilityDamage?: boolean;
  /** Magic bonus added to both to-hit and damage. */
  magic?: number;
  /** How many of this weapon the character carries; absent = 1. */
  quantity?: number;
  /** To-hit bonus added to the attack roll (may be negative); absent = none. */
  attackBonus?: number;
  /** Number of damage dice. */
  count: number;
  /** Sides on each die; 0 = no dice (flat damage only). */
  die: number;
  /** Flat damage bonus (may be negative). */
  bonus: number;
  type: string;
}

/** What an attack needs from its owner to compute live numbers. A PartyMember fits. */
export interface AttackContext {
  abilities?: Partial<Abilities>;
  level: number;
  spellcastingAbility?: AbilityKey;
}

export const ATTACK_ABILITY_LABELS: Record<AttackAbility, string> = { str: "STR", dex: "DEX", finesse: "Finesse (STR or DEX)", spell: "Spell", none: "None" };

/** Ability modifier an attack uses; 0 for legacy attacks, "none", and Spell with no spellcasting ability. */
export function attackAbilityMod(ctx: AttackContext, a: Attack): number {
  if (!a.ability || a.ability === "none") return 0;
  const ab = { ...DEFAULT_ABILITIES, ...ctx.abilities };
  const mod = (k: AbilityKey) => abilityMod(ab[k]);
  if (a.ability === "finesse") return Math.max(mod("str"), mod("dex"));
  if (a.ability === "spell") return ctx.spellcastingAbility ? mod(ctx.spellcastingAbility) : 0;
  return mod(a.ability);
}

/** Proficiency bonus an attack adds to hit; 0 for legacy attacks and when not proficient. */
export const attackProficiency = (ctx: AttackContext, a: Attack) =>
  a.ability && a.proficient !== false ? proficiencyBonus(ctx.level) : 0;

/** To-hit for an attack; legacy attacks keep their stored bonus (null when none). */
export function attackToHit(ctx: AttackContext, a: Attack): number | null {
  if (!a.ability) return a.attackBonus ? a.attackBonus : null;
  return attackAbilityMod(ctx, a) + attackProficiency(ctx, a) + (a.magic ?? 0);
}

/** Damage added on top of the dice: ability mod (unless abilityDamage is false) + magic + flat bonus (no proficiency). Legacy attacks: flat bonus only. */
export const attackDamageBonus = (a: Attack, ctx?: AttackContext) =>
  a.bonus + (ctx && a.ability ? (a.abilityDamage === false ? 0 : attackAbilityMod(ctx, a)) + (a.magic ?? 0) : 0);

/** Dice expression for the roller, e.g. "2d6+3"; null when the attack has no damage. Pass ctx to include ability mod and magic. */
export function attackExpression(a: Attack, ctx?: AttackContext): string | null {
  const bonus = attackDamageBonus(a, ctx);
  const dice = a.count > 0 && a.die > 0 ? `${a.count}d${a.die}` : "";
  if (!dice) return bonus ? String(Math.max(0, bonus)) : null;
  return bonus ? `${dice}${bonus > 0 ? "+" : "-"}${Math.abs(bonus)}` : dice;
}

/** "Dagger" or "Dagger ×3". */
export const attackLabel = (a: Attack) => countLabel(a);

/** "+5 to hit", or "" when the attack has no to-hit bonus. Pass ctx to compute new-style attacks. */
export function attackToHitText(a: Attack, ctx?: AttackContext): string {
  const n = ctx ? attackToHit(ctx, a) : a.ability ? null : a.attackBonus || null;
  return n === null ? "" : `${signed(n)} to hit`;
}

/** "2d6+3 slashing", or "—" with no damage. */
export function attackDamageText(a: Attack, ctx?: AttackContext): string {
  const e = attackExpression(a, ctx);
  return e ? `${e}${a.type ? ` ${a.type}` : ""}` : "—";
}

/** "+5 to hit — 2d6+3 slashing" (to-hit part omitted for legacy attacks with none). */
export const attackSummary = (a: Attack, ctx?: AttackContext) =>
  [attackToHitText(a, ctx), attackDamageText(a, ctx)].filter(Boolean).join(" — ");

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

/** "Candle (10)" → { name: "Candle", quantity: 10 }; SRD pack contents carry their count in brackets. */
export function parsePackItem(s: string): PackItem {
  const m = s.trim().match(/^(.*?)\s*\((\d+)\)$/);
  if (!m) return { name: s.trim() };
  const quantity = toCount(Number(m[2]));
  return quantity > 1 ? { name: m[1], quantity } : { name: m[1] };
}

/** The SRD equipment entry named `name` (case-insensitive), if any. */
export const findSrdItem = <T extends { name: string }>(name: string, srd: T[] | undefined) => {
  const key = name.trim().toLowerCase();
  return srd?.find((x) => x.name.toLowerCase() === key);
};

/** A new equipment entry. A name matching an SRD pack becomes that pack with its contents filled in;
 *  `asPack` makes any name a pack (empty unless the SRD knows its contents). */
export function newEquipmentEntry(name: string, count: number, srd: { name: string; contents?: string[] }[] | undefined, asPack = false): EquipmentEntry {
  const hit = findSrdItem(name, srd);
  const contents = hit?.contents?.length ? hit.contents.map(parsePackItem) : asPack ? [] : undefined;
  const entry: EquipmentEntry = { name: hit?.name ?? name.trim(), ...(contents ? { contents } : {}) };
  return count > 1 ? { ...entry, quantity: count } : entry;
}
