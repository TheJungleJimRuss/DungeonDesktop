/** Pure auto-fill of a character sheet from SRD class, species and background. No storage or UI here. */
import { asList, migrateAutoLists, type AutoAdded, type PartyMember, type PartyMemberInput } from "../storage/party";
import type { CharacterData, Class } from "../srd/character";
import { levelForXp } from "./xp";
import { ABILITIES, ABILITY_NAMES, NO_COINS, SKILLS, abilityMod, asEquipment, type AbilityKey, type EquipmentEntry, type SkillProficiencies } from "./sheet";

/** Fields the sheet can fill itself. A field named in `member.manual` is left as the DM typed it. */
export type AutoField = "saves" | "hitDice" | "maxHp" | "spellcastingAbility" | "spellSlots" | "speed" | "level";

/** Which PartyMember keys each auto field owns. */
export const AUTO_FIELD_KEYS: Record<AutoField, (keyof PartyMember)[]> = {
  saves: ["saveProficiencies"], hitDice: ["hitDice"], maxHp: ["maxHp"], spellcastingAbility: ["spellcastingAbility"],
  spellSlots: ["spellSlotsMax"], speed: ["speed"], level: ["level"],
};

const CASTER_ABILITY: Record<string, AbilityKey> = {
  bard: "cha", paladin: "cha", sorcerer: "cha", warlock: "cha", cleric: "wis", druid: "wis", ranger: "wis", wizard: "int",
};
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

const abilityFromName = (s: string): AbilityKey | undefined =>
  ABILITIES.find((a) => a === s.toLowerCase() || ABILITY_NAMES[a].toLowerCase() === s.toLowerCase());

export const classOf = (member: Pick<PartyMemberInput, "classId">, srd: CharacterData): Class | undefined =>
  member.classId ? srd.classes.find((c) => c.id === member.classId) : undefined;

/** Hit points for a level: first level takes the die max, later levels the die average; never below 1 per level. */
export function autoMaxHp(hitDie: number, level: number, con: number): number {
  const mod = abilityMod(con);
  let hp = Math.max(1, hitDie + mod);
  for (let l = 2; l <= level; l++) hp += Math.max(1, Math.floor(hitDie / 2) + 1 + mod);
  return hp;
}

/** The class-level row in force at `level` (the highest row at or below it). */
const rowAt = (cls: Class, level: number) =>
  [...cls.levels].filter((r) => r.level <= level).sort((a, b) => b.level - a.level)[0];

/** The character level a species trait starts at, read from SRD wording ("When you reach character level 5", "Starting at character level 5"); 1 otherwise. */
export function traitMinLevel(description: string | undefined): number {
  const m = description?.match(/(?:reach|starting at|at) character level (\d+)/i);
  return m ? Number(m[1]) : 1;
}

const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];

/**
 * Everything the SRD can say about this member, ignoring `manual`: class-driven fields (only with an SRD class),
 * species speed, and the generated lists. Keys are present only when computable, so `key in result` means "auto applies".
 */
export function computeAuto(member: PartyMemberInput, srd: CharacterData): Partial<PartyMember> {
  const out: Partial<PartyMember> = {};
  const fromXp = Number.isFinite(member.xp);
  // The level the other fields follow: XP-derived unless the DM typed one (milestone play) or there is no XP.
  const level = fromXp && !member.manual?.level ? levelForXp(member.xp!) : Math.max(1, Math.floor(member.level) || 1);
  if (fromXp) out.level = level;
  const cls = classOf(member, srd);
  const species = member.speciesId ? srd.species.find((s) => s.id === member.speciesId) : undefined;
  const sub = species && member.subspeciesId ? srd.subspecies.find((s) => s.id === member.subspeciesId && s.species.id === species.id) : undefined;
  const bg = member.backgroundId ? srd.backgrounds.find((b) => b.id === member.backgroundId) : undefined;
  const feat = (id: string) => srd.classFeatures.find((f) => f.id === id)?.name;

  if (cls) {
    out.saveProficiencies = cls.savingThrows.map(abilityFromName).filter((a): a is AbilityKey => !!a);
    out.hitDice = `${level}d${cls.hitDie}`;
    out.maxHp = autoMaxHp(cls.hitDie, level, Number.isFinite(member.abilities?.con) ? member.abilities!.con : 10);
    out.spellcastingAbility = cls.spellcastingAbility ?? CASTER_ABILITY[cls.id] ?? CASTER_ABILITY[cls.name.toLowerCase()];
    const row = rowAt(cls, level);
    const slots = ORDINALS.map((k) => (typeof row?.columns[k] === "number" ? (row!.columns[k] as number) : 0));
    out.spellSlotsMax = slots.some((n) => n > 0) ? slots : [];
  }
  if (species) out.speed = `${species.speed} ft.`;

  // A subclass only counts for its own class. Once picked, it replaces the class's "<Class> Subclass" placeholder feature.
  const subclass = cls && member.subclassId ? srd.subclasses.find((s) => s.id === member.subclassId && s.class.id === cls.id) : undefined;
  const features = [
    ...(cls?.levels.filter((r) => r.level <= level).flatMap((r) => r.featureIds.filter((id) => !(subclass && id.endsWith("-subclass"))).map(feat)) ?? []),
    ...(subclass?.features.filter((f) => f.level <= level).map((f) => f.name) ?? []),
    bg?.feat.name, ...[...(species?.traits ?? []), ...(sub?.traits ?? [])]
      .filter((t) => traitMinLevel(srd.traits.find((x) => x.id === t.id)?.description) <= level)
      .map((t) => t.name),
  ].filter((x): x is string => !!x);
  out.autoFeatures = uniq(features);
  if (out.maxHp !== undefined) out.maxHp += hpBonusPerLevel([...out.autoFeatures, ...ownEntries(member.features, member.autoAdded?.features)]) * level;
  // "Choose one kind of Gaming Set (see …)": the background grants a tool the DM picks, so list the kind until they do.
  const chosenTools = (bg?.proficiencyChoices ?? []).map((c) => c.match(/^Choose one kind of (.+?)(?:\s*\(|$)/i)?.[1]).filter((x): x is string => !!x).map((k) => `${k} (choose one kind)`);
  out.autoProficiencies = uniq([...(cls?.proficiencies ?? []), ...(bg?.tools ?? []), ...chosenTools]);
  return out;
}

/** Features that raise the Hit Point maximum every level (2024): Dwarven Toughness +1, the Tough feat +2. */
const HP_PER_LEVEL: Record<string, number> = { "dwarven toughness": 1, tough: 2 };
function hpBonusPerLevel(features: string[]): number {
  return [...new Set(features.map((f) => f.trim().toLowerCase()))].reduce((sum, f) => sum + (HP_PER_LEVEL[f] ?? 0), 0);
}
/** Entries the DM typed in themselves: everything not generated last time. */
function ownEntries(list: string[] | undefined, generated: string[] | undefined): string[] {
  return (list ?? []).filter((x) => !(generated ?? []).includes(x));
}

/** A background's option A kit: "(A) 2 Daggers, Thieves' Tools, …, 16 GP; or (B) 50 GP" → items and gold. */
export function backgroundKit(equipment: string[]): { items: EquipmentEntry[]; gp: number } {
  const a = equipment.join(" ").match(/\(A\)\s*(.*?)\s*;\s*or\s*\(B\)/i)?.[1];
  const items: EquipmentEntry[] = [];
  let gp = 0;
  // "Gaming Set (same as above)" points back at the tool proficiency choice; the item is just "Gaming Set".
  for (const part of (a ?? "").split(/,\s*/).map((x) => x.replace(/\s*\(same as above\)/i, "").trim()).filter(Boolean)) {
    const coin = part.match(/^(\d+)\s*GP$/i);
    if (coin) { gp += Number(coin[1]); continue; }
    const qty = part.match(/^(\d+)\s+(.+)$/);
    if (!qty) { items.push({ name: part }); continue; }
    const n = Number(qty[1]);
    const name = n > 1 ? qty[2].replace(/(ch|sh|x)es$/, "$1").replace(/([^s])s$/, "$1") : qty[2];
    items.push(n > 1 ? { name, quantity: n } : { name });
  }
  return { items, gp };
}

/** What class, species and background put into the normal lists right now. */
function generatedLists(member: PartyMemberInput, srd: CharacterData) {
  const auto = computeAuto(member, srd);
  const bg = member.backgroundId ? srd.backgrounds.find((b) => b.id === member.backgroundId) : undefined;
  const kit = backgroundKit(bg?.equipment ?? []);
  return { features: auto.autoFeatures ?? [], proficiencies: auto.autoProficiencies ?? [], skills: bg?.skills ?? [], equipment: kit.items, gp: kit.gp };
}

/** Drops entries added last time that are no longer generated, then appends new ones (never one the DM already removed). */
const mergeList = (list: string[], before: string[], now: string[]) => {
  const keep = list.filter((x) => !(before.includes(x) && !now.includes(x)));
  return [...keep, ...now.filter((x) => !before.includes(x) && !keep.includes(x))];
};
const skillKey = (name: string) => SKILLS.find((s) => s.label.toLowerCase() === name.toLowerCase())?.key;

/**
 * Writes the generated features, proficiencies, background skills, kit and gold into the member's ordinary lists,
 * where the DM can edit or remove them like anything else. `autoAdded` remembers what was added, so this is idempotent,
 * never re-adds what the DM deleted, and swaps out untouched entries when the class, species, background or level changes.
 */
export function mergeAutoLists<T extends PartyMemberInput>(member: T, srd: CharacterData): T {
  const m = migrateAutoLists(member);
  const now = generatedLists(m, srd);
  const prev: AutoAdded = m.autoAdded ?? { features: [], proficiencies: [], skills: [], equipment: [], gp: 0 };
  const prevSkills = prev.skills ?? now.skills;
  const prevEquipment = prev.equipment ?? now.equipment.map((e) => e.name);
  const prevGp = prev.gp ?? now.gp;
  const out: T = { ...m };

  out.features = mergeList(asList(m.features), prev.features, now.features);
  out.proficiencies = mergeList(asList(m.proficiencies), prev.proficiencies, now.proficiencies);

  const skills: SkillProficiencies = { ...m.skills };
  for (const name of prevSkills) { const k = skillKey(name); if (k && !now.skills.includes(name) && skills[k] === "proficient") delete skills[k]; }
  for (const name of now.skills) { const k = skillKey(name); if (k && !prevSkills.includes(name) && !skills[k]) skills[k] = "proficient"; }
  if (Object.keys(skills).length || m.skills) out.skills = skills;

  const names = now.equipment.map((e) => e.name);
  const equipment = asEquipment(m.equipment).filter((e) => !(prevEquipment.includes(e.name) && !names.includes(e.name)));
  for (const e of now.equipment) if (!prevEquipment.includes(e.name) && !equipment.some((x) => x.name === e.name)) equipment.push(e);
  if (equipment.length || m.equipment) out.equipment = equipment;

  if (now.gp !== prevGp) { const purse = { ...NO_COINS, ...m.coins }; out.coins = { ...purse, gp: Math.max(0, purse.gp + now.gp - prevGp) }; }

  out.autoAdded = { features: now.features, proficiencies: now.proficiencies, skills: now.skills, equipment: names, gp: now.gp };
  return out;
}

/** The member with every auto field the DM has not overridden brought up to date. */
export function applyAuto<T extends PartyMemberInput>(member: T, srd: CharacterData): T {
  const auto = computeAuto(member, srd);
  const manual = member.manual ?? {};
  const out: T = mergeAutoLists(member, srd);
  for (const field of Object.keys(AUTO_FIELD_KEYS) as AutoField[]) {
    if (manual[field]) continue;
    for (const key of AUTO_FIELD_KEYS[field]) if (key in auto) (out as unknown as Record<string, unknown>)[key] = auto[key];
  }
  // Level-ups add HP; a smaller maximum caps current HP. Absent currentHp keeps meaning "full".
  if (member.currentHp !== undefined && out.maxHp !== member.maxHp) {
    out.currentHp = Math.max(0, Math.min(out.maxHp, member.currentHp + Math.max(0, out.maxHp - member.maxHp)));
  }
  if (out.spellSlotsUsed && out.spellSlotsMax) out.spellSlotsUsed = out.spellSlotsUsed.map((u, i) => Math.min(u, out.spellSlotsMax![i] ?? 0));
  return out;
}

/** Auto fields that currently have a computed value for this member (what the form tags "auto"). */
export function activeAutoFields(member: PartyMemberInput, srd: CharacterData): AutoField[] {
  const auto = computeAuto(member, srd);
  return (Object.keys(AUTO_FIELD_KEYS) as AutoField[]).filter((f) => AUTO_FIELD_KEYS[f].length > 0 && AUTO_FIELD_KEYS[f].every((k) => k in auto));
}

/**
 * For an older record that just matched an SRD entry: marks the fields it already holds as manual,
 * so choosing the entry does not silently overwrite numbers the DM typed.
 */
export function protectExisting(member: PartyMemberInput): NonNullable<PartyMember["manual"]> {
  const keep: NonNullable<PartyMember["manual"]> = { ...member.manual };
  if (member.saveProficiencies?.length) keep.saves = true;
  if (member.hitDice?.trim()) keep.hitDice = true;
  if (member.maxHp > 1) keep.maxHp = true;
  if (member.spellcastingAbility) keep.spellcastingAbility = true;
  if (member.spellSlotsMax?.some((n) => n > 0)) keep.spellSlots = true;
  if (member.speed?.trim()) keep.speed = true;
  if (Number.isFinite(member.xp) && levelForXp(member.xp!) !== member.level) keep.level = true;
  return keep;
}
