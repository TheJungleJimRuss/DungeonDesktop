import { useEffect, useState } from "react";
import { getDb, type CollectionRecord } from "./db";
import { useChangeVersion } from "../sync/changeBus";
import { normalizeMonster, type Monster } from "../srd/monsters";

/** Custom monsters, spells and items, stored per Campaign in the `customEntries` collection.
 *  A custom monster keeps the SRD Monster shape (minus id and name), so the Stat Block treats both alike. */
export type CustomKind = "monster" | "spell" | "item";
export type MonsterData = Omit<Monster, "id" | "name">;
/** `classes`, `ritual`, `higherLevel` and `attunement` are optional: older records and export files lack them (read as empty). */
export interface SpellData {
  level: number; school: string; castingTime: string; range: string; components: string; duration: string; desc: string;
  classes?: string[]; ritual?: boolean; higherLevel?: string;
}
export interface ItemData { type: string; rarity: string; desc: string; attunement?: string }
export type CustomData = MonsterData | SpellData | ItemData;

export interface CustomEntry extends CollectionRecord {
  kind: CustomKind;
  name: string;
  data: CustomData;
  createdAt: number;
  updatedAt: number;
}

/** Stat Block selection ids for custom entries look like `custom:<entry id>`. */
export const CUSTOM_PREFIX = "custom:";
export const customSelectionId = (entryId: string) => CUSTOM_PREFIX + entryId;
export const isCustomSelection = (id: string) => id.startsWith(CUSTOM_PREFIX);

export const emptyMonsterData = (): MonsterData => ({
  size: "Medium", type: "humanoid", alignment: "unaligned", ac: 10, hp: 1, hpRoll: "", speed: "30 ft.",
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, saves: [], skills: [],
  vulnerabilities: [], resistances: [], immunities: [], conditionImmunities: [], senses: "", languages: "",
  cr: 0, xp: 0, pb: 2, traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [],
});
export const emptySpellData = (): SpellData => ({ level: 0, school: "", castingTime: "", range: "", components: "", duration: "", desc: "", classes: [], ritual: false, higherLevel: "" });
export const emptyItemData = (): ItemData => ({ type: "", rarity: "", desc: "", attunement: "" });
export const emptyData = (kind: CustomKind): CustomData =>
  kind === "monster" ? emptyMonsterData() : kind === "spell" ? emptySpellData() : emptyItemData();

export function monsterFromEntry(e: CustomEntry): Monster {
  return normalizeMonster({ ...(e.data as MonsterData), id: customSelectionId(e.id), name: e.name });
}

export async function listCustomEntries(campaignId: string): Promise<CustomEntry[]> {
  const rows = (await (await getDb()).getAllFromIndex("customEntries", "byCampaign", campaignId)) as CustomEntry[];
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCustomEntry(id: string): Promise<CustomEntry | undefined> {
  return (await (await getDb()).get("customEntries", id)) as CustomEntry | undefined;
}

export async function createCustomEntry(campaignId: string, kind: CustomKind, name: string, data: CustomData): Promise<CustomEntry> {
  const now = Date.now();
  const entry: CustomEntry = { id: crypto.randomUUID(), campaignId, kind, name, data, createdAt: now, updatedAt: now };
  await (await getDb()).add("customEntries", entry);
  return entry;
}

export async function updateCustomEntry(id: string, patch: { name?: string; data?: CustomData }): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("customEntries", "readwrite");
  const existing = (await tx.store.get(id)) as CustomEntry | undefined;
  if (existing) await tx.store.put({ ...existing, ...patch, updatedAt: Date.now() });
  await tx.done;
}

export async function deleteCustomEntry(id: string): Promise<void> {
  await (await getDb()).delete("customEntries", id);
}

/** Copies an SRD monster into an editable custom one (the SRD original is never changed). */
export function duplicateMonster(campaignId: string, m: Monster): Promise<CustomEntry> {
  const { id: _id, name, ...data } = structuredClone(m);
  return createCustomEntry(campaignId, "monster", `${name} (copy)`, data);
}

/** Live list of a Campaign's custom entries, refreshed on any change, including from another window. */
export function useCustomEntries(campaignId: string): CustomEntry[] | undefined {
  const version = useChangeVersion("customEntries");
  const [entries, setEntries] = useState<CustomEntry[]>();
  useEffect(() => {
    let live = true;
    void listCustomEntries(campaignId).then((r) => live && setEntries(r));
    return () => { live = false; };
  }, [campaignId, version]);
  return entries;
}
