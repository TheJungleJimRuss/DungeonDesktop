import { getDb } from "./db";
import type { AutoField } from "../party/autoSheet";
import type { EquipmentEntry, Attack, Abilities, AbilityKey, Coins, SkillProficiencies } from "../party/sheet";

export interface PartyMember {
  id: string;
  campaignId: string;
  name: string;
  class: string;
  level: number;
  ac: number;
  maxHp: number;
  /** Current HP; absent on older records, where it equals max HP. */
  currentHp?: number;
  passivePerception: number;
  notes: string;

  // Character sheet extras. All optional so older records and the quick Party form keep working.
  playerName?: string;
  race?: string;
  background?: string;
  /** SRD ids for class, species and background; absent = custom (the text fields hold the display name). */
  classId?: string;
  speciesId?: string;
  /** SRD subspecies (the species' type, e.g. a Draconic Ancestor or Elven Lineage); only meaningful with speciesId. */
  subspeciesId?: string;
  /** Its SRD name, e.g. "Draconic Ancestor: Red", kept so cards need no SRD load. */
  subspecies?: string;
  backgroundId?: string;
  alignment?: string;
  xp?: number;
  inspiration?: boolean;
  speed?: string;
  hitDice?: string;
  abilities?: Abilities;
  saveProficiencies?: AbilityKey[];
  skills?: SkillProficiencies;
  spellcastingAbility?: AbilityKey;
  /** Max slots per spell level; index 0 = level 1. */
  spellSlotsMax?: number[];
  spellSlotsUsed?: number[];
  /** Older records hold one text block; read through asList(). */
  spells?: string[] | string;
  /** Older records may hold strings; read through asAttacks(). */
  attacks?: Attack[];
  /** Auto fields the DM has overridden by hand; absent = the sheet computes them. */
  manual?: Partial<Record<AutoField, true>>;
  /** Generated from class, background and species; regenerated on level change, kept apart from the DM's own lists. */
  autoFeatures?: string[];
  autoProficiencies?: string[];
  features?: string[];
  proficiencies?: string[];
  /** Older records may hold a comma/newline-separated string; read through asLanguages(). */
  languages?: string[] | string;
  /** Items and packs; older records may hold strings, read through asEquipment(). */
  equipment?: EquipmentEntry[];
  coins?: Coins;
  personality?: string;
  backstory?: string;
}

/** "Draconic Ancestor: Red" → "Red". */
export const subspeciesShortName = (name: string) => name.replace(/^[^:]*:\s*/, "");

/** Species as shown on cards: "Dragonborn (Red)" when a type is picked. */
export const speciesLabel = (m: Pick<PartyMember, "race" | "subspecies">) =>
  m.race && m.subspecies ? `${m.race} (${subspeciesShortName(m.subspecies)})` : m.race;

export const currentHpOf = (m: Pick<PartyMember, "maxHp" | "currentHp">) => m.currentHp ?? m.maxHp;

export type PartyMemberInput = Omit<PartyMember, "id" | "campaignId">;

export async function listParty(campaignId: string): Promise<PartyMember[]> {
  const rows = (await (await getDb()).getAllFromIndex("party", "byCampaign", campaignId)) as unknown as (PartyMember & { createdAt?: number })[];
  return rows.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

/** Strictly increasing, so members added in the same millisecond keep their insertion order. */
let lastCreatedAt = 0;

export async function addPartyMember(campaignId: string, input: PartyMemberInput): Promise<PartyMember> {
  lastCreatedAt = Math.max(Date.now(), lastCreatedAt + 1);
  const member = { ...input, id: crypto.randomUUID(), campaignId, createdAt: lastCreatedAt };
  await (await getDb()).add("party", member);
  return member;
}

export async function updatePartyMember(id: string, input: Partial<PartyMemberInput>): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("party", "readwrite");
  const existing = await tx.store.get(id);
  if (existing) await tx.store.put({ ...existing, ...input });
  await tx.done;
}

export async function removePartyMember(id: string): Promise<void> {
  await (await getDb()).delete("party", id);
}

/** Ending an Encounter: copies each Party combatant's remaining HP onto its Party sheet (capped at max HP). */
export async function writeBackPartyHp(combatants: { kind: string; partyId?: string; hp: number }[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("party", "readwrite");
  for (const c of combatants) {
    if (c.kind !== "party" || !c.partyId) continue;
    const m = (await tx.store.get(c.partyId)) as unknown as PartyMember | undefined;
    if (m) await tx.store.put({ ...m, currentHp: Math.max(0, Math.min(c.hp, m.maxHp)) } as never);
  }
  await tx.done;
}

/** Normalizes a list field; tolerates the earlier single-text-box format. */
/** Languages as a list; older records stored "Common, Elvish" as one string. */
export const asLanguages = (v: string[] | string | undefined): string[] =>
  Array.isArray(v) ? v : (v ?? "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export const asList = (v: string[] | string | undefined): string[] =>
  Array.isArray(v) ? v : (v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
