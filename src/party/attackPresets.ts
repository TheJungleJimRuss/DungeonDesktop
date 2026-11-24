/** Turn SRD weapons and spells into ready-to-edit attacks for the character sheet's New attack form. */
import type { EquipmentItem, Spell } from "../srd/reference";
import { DAMAGE_TYPES, type Attack } from "./sheet";

export type AttackPreset = { kind: "weapon" | "spell"; id: string; name: string; detail: string; attack: Attack };

const damageType = (t: string) => {
  const low = t.toLowerCase();
  return (DAMAGE_TYPES as readonly string[]).includes(low) ? low : "";
};

/** "1d8 Slashing (1d10 two-handed)" → 1d8 slashing; "1 Piercing" → flat 1 piercing. */
export function attackFromWeapon(w: EquipmentItem): Attack | null {
  const m = /^\s*(\d+)(?:d(\d+))?\s+([A-Za-z]+)/.exec(w.damage ?? "");
  if (!m) return null;
  const dice = m[2] !== undefined;
  const ranged = w.categories.some((c) => /ranged/i.test(c));
  const finesse = w.properties.some((p) => /finesse/i.test(p));
  return {
    name: w.name, quantity: 1, ability: finesse ? "finesse" : ranged ? "dex" : "str", proficient: true, magic: 0,
    count: dice ? Number(m[1]) : 0, die: dice ? Number(m[2]) : 0, bonus: dice ? 0 : Number(m[1]), type: damageType(m[3]),
  };
}

/** First "NdM <Type> damage" in the spell text; the spell's ability goes to hit, not to damage. */
export function attackFromSpell(s: Spell): Attack | null {
  const m = /(\d+)d(\d+)\s+([A-Za-z]+)\s+damage/i.exec(s.description);
  if (!m) return null;
  return {
    name: s.name, quantity: 1, ability: "spell", proficient: true, magic: 0, abilityDamage: false,
    count: Number(m[1]), die: Number(m[2]), bonus: 0, type: damageType(m[3]),
  };
}

/** Every SRD weapon and damaging spell as a preset, weapons first, each list name-sorted. */
export function buildAttackPresets(ref: { equipment: EquipmentItem[]; spells: Spell[] }): AttackPreset[] {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const weapons = ref.equipment.flatMap((w): AttackPreset[] => {
    const attack = attackFromWeapon(w);
    return attack ? [{ kind: "weapon", id: w.id, name: w.name, detail: w.damage ?? "", attack }] : [];
  });
  const spells = ref.spells.flatMap((s): AttackPreset[] => {
    const attack = attackFromSpell(s);
    const lvl = s.level === 0 ? "Cantrip" : `Level ${s.level}`;
    return attack ? [{ kind: "spell", id: s.id, name: s.name, detail: `${lvl} · ${attack.count}d${attack.die} ${attack.type}`.trim(), attack }] : [];
  });
  return [...weapons.sort(byName), ...spells.sort(byName)];
}

/** Name matches: names starting with the query first, then names containing it. */
export function findAttackPresets(presets: AttackPreset[], query: string, limit = 8): AttackPreset[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = presets.filter((p) => p.name.toLowerCase().startsWith(q));
  const contains = presets.filter((p) => !p.name.toLowerCase().startsWith(q) && p.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}
