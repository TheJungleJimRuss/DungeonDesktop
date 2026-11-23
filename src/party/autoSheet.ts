/** Pure auto-fill of a character sheet from SRD class, species and background. No storage or UI here. */
import type { PartyMember, PartyMemberInput } from "../storage/party";
import type { CharacterData, Class } from "../srd/character";
import { levelForXp } from "./xp";
import { ABILITIES, ABILITY_NAMES, SKILLS, abilityMod, type AbilityKey, type SkillProficiencies } from "./sheet";

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

  const features = [
    ...(cls?.levels.filter((r) => r.level <= level).flatMap((r) => r.featureIds.map(feat)) ?? []),
    bg?.feat.name, ...(species?.traits.map((t) => t.name) ?? []),
  ].filter((x): x is string => !!x);
  out.autoFeatures = uniq(features);
  out.autoProficiencies = uniq([...(cls?.proficiencies ?? []), ...(bg?.tools ?? [])]);
  return out;
}

/** Background skills marked proficient; an existing proficient/expertise is never downgraded. */
function withBackgroundSkills(skills: SkillProficiencies | undefined, names: string[]): SkillProficiencies | undefined {
  if (!names.length) return skills;
  const next = { ...skills };
  for (const name of names) {
    const def = SKILLS.find((s) => s.label.toLowerCase() === name.toLowerCase());
    if (def && !next[def.key]) next[def.key] = "proficient";
  }
  return next;
}

/** The member with every auto field the DM has not overridden brought up to date. */
export function applyAuto<T extends PartyMemberInput>(member: T, srd: CharacterData): T {
  const auto = computeAuto(member, srd);
  const manual = member.manual ?? {};
  const out: T = { ...member };
  for (const field of Object.keys(AUTO_FIELD_KEYS) as AutoField[]) {
    if (manual[field]) continue;
    for (const key of AUTO_FIELD_KEYS[field]) if (key in auto) (out as unknown as Record<string, unknown>)[key] = auto[key];
  }
  const bg = member.backgroundId ? srd.backgrounds.find((b) => b.id === member.backgroundId) : undefined;
  out.skills = withBackgroundSkills(member.skills, bg?.skills ?? []);
  if (!out.skills) delete out.skills;
  if (auto.autoFeatures?.length || member.autoFeatures) out.autoFeatures = auto.autoFeatures;
  if (auto.autoProficiencies?.length || member.autoProficiencies) out.autoProficiencies = auto.autoProficiencies;
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
