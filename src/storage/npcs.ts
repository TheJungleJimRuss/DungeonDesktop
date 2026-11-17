import { useEffect, useState, useSyncExternalStore } from "react";
import { getDb, type CollectionRecord } from "./db";
import { onChange } from "../sync/changeBus";

export interface NpcSecret {
  id: string;
  text: string;
  revealed: boolean;
}

/** An NPC card, stored in the `npcs` collection.
 *  `locationTag` is free text for now; ticket 07 adds `locationId` (optional, so no migration)
 *  and then treats the tag as the display name of the linked location. */
export interface Npc extends CollectionRecord, NpcDraft {
  createdAt: number;
  updatedAt: number;
}

export interface NpcDraft {
  name: string;
  role: string;
  appearance: string;
  motivation: string;
  notes: string;
  secrets: NpcSecret[];
  factionTag: string;
  locationTag: string;
  /** Set when linked to a real location; then `locationTag` mirrors that location's name. */
  locationId?: string;
  /** Linked Stat Block: an SRD monster id or `custom:<entry id>` (the Stat Block selection id format). Optional: no migration needed. */
  statBlockId?: string;
}

export const emptyNpcDraft = (): NpcDraft => ({
  name: "", role: "", appearance: "", motivation: "", notes: "", secrets: [], factionTag: "", locationTag: "",
});

const newId = () => crypto.randomUUID();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());
/** For other collections (locations) whose edits change what NPCs display. */
export const notifyNpcsChanged = changed;

export async function listNpcs(campaignId: string): Promise<Npc[]> {
  const rows = (await (await getDb()).getAllFromIndex("npcs", "byCampaign", campaignId)) as Npc[];
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createNpc(campaignId: string, draft: NpcDraft): Promise<Npc> {
  const now = Date.now();
  const npc: Npc = { ...draft, id: newId(), campaignId, createdAt: now, updatedAt: now };
  await (await getDb()).add("npcs", npc);
  changed();
  return npc;
}

export async function updateNpc(id: string, patch: Partial<NpcDraft>): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("npcs", "readwrite");
  const existing = (await tx.store.get(id)) as Npc | undefined;
  if (existing) {
    const next = { ...existing, ...patch, updatedAt: Date.now() };
    if (next.locationId === undefined) delete next.locationId;
    if (next.statBlockId === undefined) delete next.statBlockId;
    await tx.store.put(next);
  }
  await tx.done;
  changed();
}

export async function deleteNpc(id: string): Promise<void> {
  await (await getDb()).delete("npcs", id);
  changed();
}

/** Live list of a Campaign's NPCs (reloads whenever any NPC changes). `undefined` while loading. */
export function useNpcs(campaignId: string): Npc[] | undefined {
  const [npcs, setNpcs] = useState<Npc[]>();
  useEffect(() => {
    let live = true;
    const load = () => void listNpcs(campaignId).then((r) => live && setNpcs(r));
    load();
    listeners.add(load);
    const off = onChange("npcs", load); // changes made in another window
    return () => { live = false; listeners.delete(load); off(); };
  }, [campaignId]);
  return npcs;
}

/* ---- Selection: which NPC the card panel shows. ----
 * Per Campaign, kept in localStorage and a tiny pub/sub, so the list and card panels
 * share it without a common parent (and a future Pop-out Window shares it via the
 * `storage` event). "new" means a blank card is being drafted. */
export const NEW_NPC = "new";
const selKey = (campaignId: string) => `dungeon-desktop:npc-selection:${campaignId}`;
const readSel = (campaignId: string): string | null => {
  try { return localStorage.getItem(selKey(campaignId)); } catch { return null; }
};
const memory = new Map<string, string | null>();

export function selectNpc(campaignId: string, id: string | null): void {
  memory.set(campaignId, id);
  try {
    if (id) localStorage.setItem(selKey(campaignId), id); else localStorage.removeItem(selKey(campaignId));
  } catch { /* storage unavailable: in-memory only */ }
  changed();
}

export function useSelectedNpcId(campaignId: string): string | null {
  const subscribe = (cb: () => void) => {
    const onStorage = (e: StorageEvent) => { if (e.key === selKey(campaignId)) cb(); };
    listeners.add(cb);
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
  };
  const get = () => readSel(campaignId) ?? memory.get(campaignId) ?? null;
  return useSyncExternalStore(subscribe, get);
}
