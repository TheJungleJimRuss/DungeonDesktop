import { useEffect, useState } from "react";
import { getDb, type CollectionRecord } from "./db";
import { useChangeVersion } from "../sync/changeBus";
import type { Encounter } from "../combat/rules";
import type { BattleMap } from "./battleMaps";

/** At most one in-progress Encounter per Campaign, stored in the `encounters` collection. Ending it deletes the record. */
type Row = Encounter & CollectionRecord;

export async function getActiveEncounter(campaignId: string): Promise<Encounter | undefined> {
  const rows = (await (await getDb()).getAllFromIndex("encounters", "byCampaign", campaignId)) as unknown as Row[];
  return rows.sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** Saves the Encounter and drops Battle Map tokens whose Combatant is gone (so removal works from any panel or window). */
export async function saveEncounter(e: Encounter): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["encounters", "battleMaps"], "readwrite");
  await tx.objectStore("encounters").put(e as unknown as CollectionRecord);
  const map = (await tx.objectStore("battleMaps").get(e.id)) as unknown as BattleMap | undefined;
  const alive = new Set(e.combatants.map((c) => c.id));
  if (map?.tokens.some((t) => t.combatantId && !alive.has(t.combatantId))) {
    const next = { ...map, tokens: map.tokens.filter((t) => !t.combatantId || alive.has(t.combatantId)) };
    await tx.objectStore("battleMaps").put(next as unknown as CollectionRecord);
  }
  await tx.done;
}

export async function endEncounter(campaignId: string): Promise<void> {
  const db = await getDb();
  const rows = await db.getAllFromIndex("encounters", "byCampaign", campaignId);
  for (const r of rows) { await db.delete("encounters", r.id); await db.delete("battleMaps", r.id); } // the Battle Map is keyed by encounter id
}

/** Live in-progress Encounter: `undefined` while loading, `null` when none. */
export function useActiveEncounter(campaignId: string): Encounter | null | undefined {
  const version = useChangeVersion("encounters");
  const [enc, setEnc] = useState<Encounter | null>();
  useEffect(() => {
    let live = true;
    void getActiveEncounter(campaignId).then((r) => live && setEnc(r ?? null));
    return () => { live = false; };
  }, [campaignId, version]);
  return enc;
}
