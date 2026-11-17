import { addCombatant, newEncounter, type Combatant, type Encounter } from "./rules";

/** A reusable composition: monsters and ad-hoc entries only (no initiative, no numbering). The Party is added fresh on load. */
export interface SavedMember { kind: "monster" | "adhoc"; name: string; hp: number; dexMod: number; monsterId?: string; }

/** Strips the auto-number from a monster copy: "Goblin 2" -> "Goblin". */
const baseName = (c: Combatant) => (c.kind === "monster" ? c.name.replace(/ \d+$/, "") : c.name);

export function compositionOf(enc: Encounter): SavedMember[] {
  return enc.combatants.filter((c) => c.kind !== "party" && c.kind !== "lair").map((c) => {
    const m: SavedMember = { kind: c.kind as SavedMember["kind"], name: baseName(c), hp: c.hp, dexMod: c.dexMod };
    if (c.monsterId) m.monsterId = c.monsterId;
    return m;
  });
}

/** "Goblin Warrior ×2, Bandit" */
export function summarize(members: SavedMember[]): string {
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.name, (counts.get(m.name) ?? 0) + 1);
  return [...counts].map(([n, k]) => (k > 1 ? `${n} ×${k}` : n)).join(", ");
}

export function encounterFrom(campaignId: string, members: SavedMember[], party: { id?: string; name: string; maxHp: number; currentHp?: number }[]): Encounter {
  const withParty = party.reduce((e, p) => addCombatant(e, { kind: "party", name: p.name, hp: p.currentHp ?? p.maxHp, maxHp: p.maxHp, dexMod: 0, partyId: p.id }), newEncounter(campaignId));
  return members.reduce((e, m) => addCombatant(e, { ...m }), withParty);
}

const bodies = (enc: Encounter) => enc.combatants.filter((c) => c.kind !== "party" && c.kind !== "lair");

/** A key that survives Load (which recreates every Combatant): Party members by their Party id, the rest by position in the saved composition. */
export function linkKeyOf(enc: Encounter, combatantId: string): string | undefined {
  const c = enc.combatants.find((x) => x.id === combatantId);
  if (!c) return undefined;
  if (c.kind === "party") return c.partyId ? `p:${c.partyId}` : undefined;
  const i = bodies(enc).indexOf(c);
  return i >= 0 ? `m:${i}` : undefined;
}

/** The Combatant of a (re)loaded Encounter that a link key from `linkKeyOf` points at. */
export function combatantForLink(enc: Encounter, key: string): string | undefined {
  if (key.startsWith("p:")) return enc.combatants.find((c) => c.kind === "party" && c.partyId === key.slice(2))?.id;
  return bodies(enc)[Number(key.slice(2))]?.id;
}
