import { useEffect, useState } from "react";
import { getDb, type CollectionRecord } from "./db";
import { useChangeVersion } from "../sync/changeBus";
import type { SavedMember } from "../combat/saved";
import type { SavedToken } from "./maps";

export interface SavedEncounter { id: string; campaignId: string; name: string; members: SavedMember[]; createdAt: number; mapId?: string; tokens?: SavedToken[]; spot?: { x: number; y: number }; }

export async function listSavedEncounters(campaignId: string): Promise<SavedEncounter[]> {
  const rows = (await (await getDb()).getAllFromIndex("savedEncounters", "byCampaign", campaignId)) as unknown as SavedEncounter[];
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function createSavedEncounter(campaignId: string, name: string, members: SavedMember[], map?: { mapId: string; tokens: SavedToken[]; spot?: { x: number; y: number } }): Promise<void> {
  const row: SavedEncounter = { id: crypto.randomUUID(), campaignId, name, members, createdAt: Date.now(), ...(map ? { mapId: map.mapId, tokens: map.tokens, ...(map.spot ? { spot: map.spot } : {}) } : {}) };
  await (await getDb()).add("savedEncounters", row as unknown as CollectionRecord);
}

export async function renameSavedEncounter(id: string, name: string): Promise<void> {
  const db = await getDb();
  const row = await db.get("savedEncounters", id);
  if (row) await db.put("savedEncounters", { ...row, name });
}

export async function deleteSavedEncounter(id: string): Promise<void> {
  await (await getDb()).delete("savedEncounters", id);
}

export function useSavedEncounters(campaignId: string): SavedEncounter[] {
  const version = useChangeVersion("savedEncounters");
  const [rows, setRows] = useState<SavedEncounter[]>([]);
  useEffect(() => {
    let live = true;
    void listSavedEncounters(campaignId).then((r) => live && setRows(r));
    return () => { live = false; };
  }, [campaignId, version]);
  return rows;
}
