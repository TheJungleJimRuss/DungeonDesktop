/**
 * Custom monster editor model (spec 0010). Pure: turns the stored `MonsterData` (SRD Monster shape minus id/name, strings
 * like "40 ft., Fly 80 ft. (hover)" and "DEX +6") into structured form state and back. Anything a parser does not
 * recognise is kept in an "other" field, so opening and saving a duplicated SRD monster loses nothing.
 */
import type { Entry } from "./monsters";
import type { MonsterData } from "../storage/customEntries";
import { DAMAGE_TYPES } from "../combat/damageTypes";
import { ABILITIES, SKILLS, abilityMod, signed, type AbilityKey } from "../party/sheet";

export { abilityMod, signed };

export const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"] as const;
export const MONSTER_TYPES = [
  "aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey", "fiend", "giant", "humanoid",
  "monstrosity", "ooze", "plant", "undead", "swarm of tiny beasts",
] as const;
export const CONDITIONS = [
  "Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed",
  "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
] as const;
export const LANGUAGE_SUGGESTIONS = [
  "Common", "Common Sign Language", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc",
  "Abyssal", "Celestial", "Deep Speech", "Druidic", "Infernal", "Primordial", "Sylvan", "Thieves' Cant", "Undercommon",
] as const;

// ---- Challenge rating ----------------------------------------------------------------------------------------------

export const CR_OPTIONS: number[] = [0, 0.125, 0.25, 0.5, ...Array.from({ length: 30 }, (_, i) => i + 1)];
export const CR_XP: Record<number, number> = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000,
  10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
};
/** Proficiency bonus for a challenge rating. */
export const crToPb = (cr: number) => (cr < 5 ? 2 : cr < 9 ? 3 : cr < 13 ? 4 : cr < 17 ? 5 : cr < 21 ? 6 : cr < 25 ? 7 : cr < 29 ? 8 : 9);

// ---- Form type -----------------------------------------------------------------------------------------------------

export type AbilityScores = MonsterData["abilities"];
export interface SaveRow { ability: AbilityKey; bonus: number | null }
export interface SkillRow { key: string; level: "proficient" | "expertise"; bonus: number | null }
export interface MonsterForm {
  name: string;
  size: string; type: string; alignment: string;
  cr: number; xp: number; pb: number;
  /** XP when met in its lair; null = none. */
  xpInLair: number | null;
  gear: string;
  ac: number; acNote: string; hp: number; hpRoll: string;
  speed: { walk: number | null; burrow: number | null; climb: number | null; fly: number | null; swim: number | null; hover: boolean; other: string };
  abilities: AbilityScores;
  /** null bonus = automatic (mod + PB). */
  saves: SaveRow[];
  /** Save parts that are not "ABL +N" or repeat an ability, kept as written. */
  otherSaves: string[];
  /** null bonus = automatic (mod + PB, or mod + 2 PB for expertise). */
  skills: SkillRow[];
  /** Skill parts the editor does not know, kept as written. */
  otherSkills: string[];
  senses: {
    blindsight: number | null; darkvision: number | null; tremorsense: number | null; truesight: number | null;
    /** "Darkvision N ft. (unimpeded by magical darkness)". */
    darkvisionUnimpeded: boolean;
    other: string;
    /** Stored Passive Perception that differs from the computed value; null = use the computed one. */
    passiveOverride: number | null;
  };
  /** One row per language (or "understands ..." phrase), without the telepathy part. */
  languages: string[];
  telepathy: number | null;
  vulnerabilities: string[]; resistances: string[]; immunities: string[]; conditionImmunities: string[];
  traits: Entry[]; actions: Entry[]; bonusActions: Entry[]; reactions: Entry[]; legendaryActions: Entry[];
  legendaryUses: number;
}

// ---- Bonus maths ---------------------------------------------------------------------------------------------------

export const autoSaveBonus = (abilities: AbilityScores, ability: AbilityKey, pb: number) => abilityMod(abilities[ability]) + pb;
export const autoSkillBonus = (abilities: AbilityScores, key: string, level: "proficient" | "expertise", pb: number) => {
  const def = SKILLS.find((s) => s.key === key);
  return (def ? abilityMod(abilities[def.ability]) : 0) + pb * (level === "expertise" ? 2 : 1);
};
export const saveBonusOf = (row: SaveRow, abilities: AbilityScores, pb: number) => row.bonus ?? autoSaveBonus(abilities, row.ability, pb);
export const skillBonusOf = (row: SkillRow, abilities: AbilityScores, pb: number) => row.bonus ?? autoSkillBonus(abilities, row.key, row.level, pb);

/** 10 + the Perception bonus if the skill is listed, else 10 + the Wisdom modifier. */
export function passivePerception(abilities: AbilityScores, skills: SkillRow[], pb: number): number {
  const row = skills.find((s) => s.key === "perception");
  return 10 + (row ? skillBonusOf(row, abilities, pb) : abilityMod(abilities.wis));
}

// ---- Splitting helpers ---------------------------------------------------------------------------------------------

/** Splits on a separator that is not inside parentheses; trims and drops empty parts. */
export function splitTop(s: string, sep: string | RegExp): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  const re = typeof sep === "string" ? new RegExp(`^${sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) : new RegExp(`^(?:${sep.source})`);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const m = re.exec(s.slice(i));
      if (m && m[0].length > 0) { out.push(cur); cur = ""; i += m[0].length - 1; continue; }
    }
    cur += c;
  }
  out.push(cur);
  return out.map((p) => p.trim()).filter(Boolean);
}

const parseSigned = (s: string) => Number(s.replace(/[−–]/g, "-"));
const ABBR: Record<AbilityKey, string> = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };

// ---- Speed ---------------------------------------------------------------------------------------------------------

export type SpeedForm = MonsterForm["speed"];
export const emptySpeed = (): SpeedForm => ({ walk: null, burrow: null, climb: null, fly: null, swim: null, hover: false, other: "" });

export function parseSpeed(s: string): SpeedForm {
  const out = emptySpeed();
  const other: string[] = [];
  for (const part of splitTop(s ?? "", ",")) {
    const walk = /^(\d+) ft\.?$/i.exec(part);
    const mode = /^(Burrow|Climb|Fly|Swim) (\d+) ft\.?(?: \((hover)\))?$/i.exec(part);
    if (walk && out.walk === null) out.walk = Number(walk[1]);
    else if (mode) {
      const k = mode[1].toLowerCase() as "burrow" | "climb" | "fly" | "swim";
      if (out[k] !== null || (mode[3] && k !== "fly")) other.push(part);
      else { out[k] = Number(mode[2]); if (mode[3]) out.hover = true; }
    } else other.push(part);
  }
  out.other = other.join(", ");
  return out;
}

export function formatSpeed(sp: SpeedForm): string {
  const parts: string[] = [];
  if (sp.walk !== null) parts.push(`${sp.walk} ft.`);
  if (sp.burrow !== null) parts.push(`Burrow ${sp.burrow} ft.`);
  if (sp.climb !== null) parts.push(`Climb ${sp.climb} ft.`);
  if (sp.fly !== null) parts.push(`Fly ${sp.fly} ft.${sp.hover ? " (hover)" : ""}`);
  if (sp.swim !== null) parts.push(`Swim ${sp.swim} ft.`);
  if (sp.other.trim()) parts.push(sp.other.trim());
  return parts.join(", ");
}

// ---- Senses --------------------------------------------------------------------------------------------------------

export type SensesForm = MonsterForm["senses"];
export const emptySenses = (): SensesForm => ({
  blindsight: null, darkvision: null, tremorsense: null, truesight: null, darkvisionUnimpeded: false, other: "", passiveOverride: null,
});
const UNIMPEDED = "(unimpeded by magical darkness)";

/** Parses senses. `computedPassive` is what the editor would write; a different stored value is kept as an override. */
export function parseSenses(s: string, computedPassive: number): SensesForm {
  const out = emptySenses();
  const other: string[] = [];
  for (const part of splitTop(s ?? "", ",")) {
    const pp = /^Passive Perception (\d+)$/i.exec(part);
    const sense = /^(Blindsight|Darkvision|Tremorsense|Truesight) (\d+) ft\.?(?: (\(unimpeded by magical darkness\)))?$/i.exec(part);
    if (pp && out.passiveOverride === null) {
      const n = Number(pp[1]);
      if (n !== computedPassive) out.passiveOverride = n;
      else out.passiveOverride = null;
    } else if (sense) {
      const k = sense[1].toLowerCase() as "blindsight" | "darkvision" | "tremorsense" | "truesight";
      if (out[k] !== null || (sense[3] && k !== "darkvision")) other.push(part);
      else { out[k] = Number(sense[2]); if (sense[3]) out.darkvisionUnimpeded = true; }
    } else other.push(part);
  }
  out.other = other.join(", ");
  return out;
}

export function formatSenses(se: SensesForm, computedPassive: number): string {
  const parts: string[] = [];
  if (se.blindsight !== null) parts.push(`Blindsight ${se.blindsight} ft.`);
  if (se.darkvision !== null) parts.push(`Darkvision ${se.darkvision} ft.${se.darkvisionUnimpeded ? ` ${UNIMPEDED}` : ""}`);
  if (se.tremorsense !== null) parts.push(`Tremorsense ${se.tremorsense} ft.`);
  if (se.truesight !== null) parts.push(`Truesight ${se.truesight} ft.`);
  if (se.other.trim()) parts.push(se.other.trim());
  parts.push(`Passive Perception ${se.passiveOverride ?? computedPassive}`);
  return parts.join(", ");
}

// ---- Saves and skills ----------------------------------------------------------------------------------------------

export function parseSaves(list: string[], abilities: AbilityScores, pb: number): { saves: SaveRow[]; other: string[] } {
  const saves: SaveRow[] = [], other: string[] = [];
  for (const raw of list ?? []) {
    const m = new RegExp(`^(STR|DEX|CON|INT|WIS|CHA) ([+\\-\\u2212\\u2013]?\\d+)$`, "i").exec(raw.trim());
    const ability = m ? (m[1].toLowerCase() as AbilityKey) : null;
    if (!m || !ability || saves.some((s) => s.ability === ability)) { other.push(raw); continue; }
    const bonus = parseSigned(m[2]);
    saves.push({ ability, bonus: bonus === autoSaveBonus(abilities, ability, pb) ? null : bonus });
  }
  return { saves, other };
}

export function formatSaves(saves: SaveRow[], other: string[], abilities: AbilityScores, pb: number): string[] {
  const rows = ABILITIES.flatMap((a) => saves.filter((s) => s.ability === a).slice(0, 1));
  return [...rows.map((s) => `${ABBR[s.ability]} ${signed(saveBonusOf(s, abilities, pb))}`), ...other.filter((o) => o.trim())];
}

export function parseSkills(list: string[], abilities: AbilityScores, pb: number): { skills: SkillRow[]; other: string[] } {
  const skills: SkillRow[] = [], other: string[] = [];
  for (const raw of list ?? []) {
    const m = new RegExp(`^(.+?) ([+\\-\\u2212\\u2013]?\\d+)$`).exec(raw.trim());
    const def = m ? SKILLS.find((s) => s.label.toLowerCase() === m[1].toLowerCase()) : undefined;
    if (!m || !def || skills.some((s) => s.key === def.key)) { other.push(raw); continue; }
    const bonus = parseSigned(m[2]);
    if (bonus === autoSkillBonus(abilities, def.key, "proficient", pb)) skills.push({ key: def.key, level: "proficient", bonus: null });
    else if (bonus === autoSkillBonus(abilities, def.key, "expertise", pb)) skills.push({ key: def.key, level: "expertise", bonus: null });
    else skills.push({ key: def.key, level: "proficient", bonus });
  }
  return { skills, other };
}

export function formatSkills(skills: SkillRow[], other: string[], abilities: AbilityScores, pb: number): string[] {
  const rows = SKILLS.flatMap((d) => skills.filter((s) => s.key === d.key).slice(0, 1).map((s) => `${d.label} ${signed(skillBonusOf(s, abilities, pb))}`));
  return [...rows, ...other.filter((o) => o.trim())];
}

// ---- Languages -----------------------------------------------------------------------------------------------------

const isSpecialLanguage = (p: string) => /^(understands|telepathy)\b/i.test(p);

export function parseLanguages(s: string): { languages: string[]; telepathy: number | null } {
  const languages: string[] = [];
  let telepathy: number | null = null;
  for (const seg of splitTop(s ?? "", ";")) {
    const tele = /^telepathy (\d+) ft\.?$/i.exec(seg);
    if (tele && telepathy === null) telepathy = Number(tele[1]);
    else if (isSpecialLanguage(seg)) languages.push(seg);
    else languages.push(...splitTop(seg, ","));
  }
  return { languages, telepathy };
}

export function formatLanguages(languages: string[], telepathy: number | null): string {
  const rows = languages.map((l) => l.trim()).filter(Boolean);
  const segs = [rows.filter((l) => !isSpecialLanguage(l)).join(", "), ...rows.filter(isSpecialLanguage)].filter(Boolean);
  if (telepathy !== null) segs.push(`telepathy ${telepathy} ft.`);
  return segs.join("; ");
}

// ---- Defenses ------------------------------------------------------------------------------------------------------

/** Splits a defense list into the checked standard names (canonical case) and the other rows. */
export function splitDefenses(list: string[], standard: readonly string[]): { checked: string[]; other: string[] } {
  const checked: string[] = [], other: string[] = [];
  for (const raw of list ?? []) {
    const hit = standard.find((t) => t.toLowerCase() === raw.trim().toLowerCase());
    if (hit && !checked.includes(hit)) checked.push(hit);
    else if (!hit && raw.trim()) other.push(raw.trim());
  }
  return { checked, other };
}
/** Standard ones first in `standard` order, then the other rows in their given order. */
export function mergeDefenses(list: string[], standard: readonly string[]): string[] {
  const { checked, other } = splitDefenses(list, standard);
  return [...standard.filter((t) => checked.includes(t)), ...other];
}

// ---- Form <-> stored -----------------------------------------------------------------------------------------------

const entries = (l: Entry[] | undefined): Entry[] => (l ?? []).map((e) => ({ name: e.name, desc: e.desc }));
const cleanEntries = (l: Entry[]): Entry[] => l.filter((e) => e.name.trim() || e.desc.trim()).map((e) => ({ name: e.name.trim(), desc: e.desc }));

export function toMonsterForm(data: MonsterData, name = ""): MonsterForm {
  const pb = data.pb;
  const saves = parseSaves(data.saves, data.abilities, pb);
  const skills = parseSkills(data.skills, data.abilities, pb);
  const lang = parseLanguages(data.languages);
  const computed = passivePerception(data.abilities, skills.skills, pb);
  return {
    name, size: data.size, type: data.type, alignment: data.alignment,
    cr: data.cr, xp: data.xp, pb, xpInLair: data.xpInLair ?? null, gear: data.gear ?? "",
    ac: data.ac, acNote: data.acNote ?? "", hp: data.hp, hpRoll: data.hpRoll,
    speed: parseSpeed(data.speed),
    abilities: { ...data.abilities },
    saves: saves.saves, otherSaves: saves.other,
    skills: skills.skills, otherSkills: skills.other,
    senses: parseSenses(data.senses, computed),
    languages: lang.languages, telepathy: lang.telepathy,
    vulnerabilities: [...(data.vulnerabilities ?? [])], resistances: [...(data.resistances ?? [])],
    immunities: [...(data.immunities ?? [])], conditionImmunities: [...(data.conditionImmunities ?? [])],
    traits: entries(data.traits), actions: entries(data.actions), bonusActions: entries(data.bonusActions),
    reactions: entries(data.reactions), legendaryActions: entries(data.legendaryActions),
    legendaryUses: data.legendaryUses ?? 3,
  };
}

/** Formats the form back to the stored shape. `base` supplies everything the form does not edit (lairActions...). */
export function fromMonsterForm(form: MonsterForm, base: MonsterData): MonsterData {
  const computed = passivePerception(form.abilities, form.skills, form.pb);
  const legendaryActions = cleanEntries(form.legendaryActions);
  const out: MonsterData = {
    ...base,
    size: form.size, type: form.type, alignment: form.alignment,
    ac: form.ac, hp: form.hp, hpRoll: form.hpRoll,
    speed: formatSpeed(form.speed),
    abilities: { ...form.abilities },
    saves: formatSaves(form.saves, form.otherSaves, form.abilities, form.pb),
    skills: formatSkills(form.skills, form.otherSkills, form.abilities, form.pb),
    vulnerabilities: mergeDefenses(form.vulnerabilities, DAMAGE_TYPES),
    resistances: mergeDefenses(form.resistances, DAMAGE_TYPES),
    immunities: mergeDefenses(form.immunities, DAMAGE_TYPES),
    conditionImmunities: mergeDefenses(form.conditionImmunities, CONDITIONS),
    senses: formatSenses(form.senses, computed),
    languages: formatLanguages(form.languages, form.telepathy),
    cr: form.cr, xp: form.xp, pb: form.pb,
    traits: cleanEntries(form.traits), actions: cleanEntries(form.actions), bonusActions: cleanEntries(form.bonusActions),
    reactions: cleanEntries(form.reactions), legendaryActions,
  };
  if (form.acNote.trim()) out.acNote = form.acNote.trim(); else delete out.acNote;
  if (form.gear.trim()) out.gear = form.gear.trim(); else delete out.gear;
  if (form.xpInLair !== null) out.xpInLair = form.xpInLair; else delete out.xpInLair;
  if (legendaryActions.length) out.legendaryUses = form.legendaryUses; else delete out.legendaryUses;
  return out;
}

// ---- Attack text ---------------------------------------------------------------------------------------------------

export interface DamageSpec { count: number; die: number; bonus: number; type: string }
export interface AttackSpec {
  kind: "melee" | "ranged" | "both";
  toHit: number;
  reach?: number;
  range?: { normal: number; long?: number };
  damage: DamageSpec[];
}

/** To-hit = ability modifier + proficiency bonus when proficient. */
export const attackToHit = (mod: number, pb: number, proficient: boolean) => mod + (proficient ? pb : 0);

export const damageAverage = (d: DamageSpec) => Math.max(1, Math.floor((d.count * (d.die + 1)) / 2) + d.bonus);

/** "7 (1d8 + 3) Slashing" (the SRD writes a negative bonus with a true minus sign). */
export function damageText(d: DamageSpec): string {
  const dice = `${d.count}d${d.die}`;
  const expr = d.bonus === 0 ? dice : d.bonus > 0 ? `${dice} + ${d.bonus}` : `${dice} − ${Math.abs(d.bonus)}`;
  return `${damageAverage(d)} (${expr}) ${d.type}`.trim();
}

/** 2024 stat-block attack text, e.g. "Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Slashing damage plus 3 (1d6) Fire damage." */
export function attackText(spec: AttackSpec): string {
  const reach = `reach ${spec.reach ?? 5} ft.`;
  const r = spec.range ?? { normal: 20 };
  const range = `range ${r.normal}${r.long ? `/${r.long}` : ""} ft.`;
  const head = spec.kind === "melee" ? `Melee Attack Roll: ${signed(spec.toHit)}, ${reach}`
    : spec.kind === "ranged" ? `Ranged Attack Roll: ${signed(spec.toHit)}, ${range}`
    : `Melee or Ranged Attack Roll: ${signed(spec.toHit)}, ${reach} or ${range}`;
  const dmg = spec.damage.map(damageText).join(" damage plus ");
  return `${head} Hit: ${dmg}${spec.damage.length ? " damage." : ""}`;
}
