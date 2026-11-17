import { useEffect, useState } from "react";
import { useChangeVersion } from "../sync/changeBus";
import { COLLECTIONS, getDb, type CampaignRecord } from "./db";

export type Campaign = CampaignRecord;

const newId = () => crypto.randomUUID();

export async function listCampaigns(): Promise<Campaign[]> {
  const all = await (await getDb()).getAll("campaigns");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  return (await getDb()).get("campaigns", id);
}

export async function createCampaign(name: string): Promise<Campaign> {
  const now = Date.now();
  const campaign: Campaign = { id: newId(), name: name.trim(), createdAt: now, updatedAt: now };
  await (await getDb()).add("campaigns", campaign);
  return campaign;
}

export async function renameCampaign(id: string, name: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("campaigns", "readwrite");
  const existing = await tx.store.get(id);
  if (existing) await tx.store.put({ ...existing, name: name.trim(), updatedAt: Date.now() });
  await tx.done;
}

/** Remembers the last Mode used in a Campaign. Does not bump updatedAt. */
export async function setLastMode(id: string, mode: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("campaigns", "readwrite");
  const existing = await tx.store.get(id);
  if (existing) await tx.store.put({ ...existing, lastMode: mode });
  await tx.done;
}

/** Copies the Campaign record and every per-Campaign collection row under new ids. */
export async function duplicateCampaign(id: string): Promise<Campaign | undefined> {
  const db = await getDb();
  const tx = db.transaction(["campaigns", ...COLLECTIONS], "readwrite");
  const source = await tx.objectStore("campaigns").get(id);
  if (!source) return undefined;
  const now = Date.now();
  const copy: Campaign = { ...source, id: newId(), name: `${source.name} (copy)`, createdAt: now, updatedAt: now };
  await tx.objectStore("campaigns").add(copy);
  for (const name of COLLECTIONS) {
    const store = tx.objectStore(name);
    for (const row of await store.index("byCampaign").getAll(id)) {
      await store.add({ ...row, id: newId(), campaignId: copy.id });
    }
  }
  await tx.done;
  return copy;
}

/** Deletes the Campaign and everything that belongs to it. */
export async function deleteCampaign(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["campaigns", ...COLLECTIONS], "readwrite");
  await tx.objectStore("campaigns").delete(id);
  for (const name of COLLECTIONS) {
    const store = tx.objectStore(name);
    for (const key of await store.index("byCampaign").getAllKeys(id)) await store.delete(key);
  }
  await tx.done;
}

/** Sets (or clears, with null) where the Party is. Does not bump updatedAt. */
export async function setPartyLocation(id: string, locationId: string | null): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("campaigns", "readwrite");
  const existing = await tx.store.get(id);
  if (existing) {
    const { partyLocationId: _old, ...rest } = existing;
    await tx.store.put(locationId ? { ...rest, partyLocationId: locationId } : rest);
  }
  await tx.done;
}

export function usePartyLocation(id: string): string | null {
  const version = useChangeVersion("campaigns");
  const [loc, setLoc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void getCampaign(id).then((c) => live && setLoc(c?.partyLocationId ?? null));
    return () => { live = false; };
  }, [id, version]);
  return loc;
}
