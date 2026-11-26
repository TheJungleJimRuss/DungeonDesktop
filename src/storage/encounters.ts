import { useEffect, useState } from "react";
import { getDb, type CollectionRecord } from "./db";
import { useChangeVersion } from "../sync/changeBus";
import { newEncounter, type Encounter } from "../combat/rules";
import { createEncounterMap, readMapView, writeMapView, type MapRecord } from "./maps";
import { BATTLE_PX_PER_SQUARE } from "../map/scale";

/** At most one in-progress Encounter per Campaign, stored in the `encounters` collection. Ending it deletes the record. */
type Row = Encounter & CollectionRecord;

export async function getActiveEncounter(campaignId: string): Promise<Encounter | undefined> {
  const rows = (await (await getDb()).getAllFromIndex("encounters", "byCampaign", campaignId)) as unknown as Row[];
  return rows.sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** A new Encounter on a Map: the picked one, or (with none) a blank Map made for it. Not saved yet; see saveEncounter.
 *  Its spot is the centre of the view on that Map. The Map panel writes its view to this device's storage on every change, so the stored view is the
 *  current one whether or not the panel is open (and a Map with no stored view, such as a brand-new one, gives (0, 0)).
 *  Zoomed out past battle scale, the view is set to battle scale at the spot, which a mounted panel picks up through onMapViewWrite. */
export async function startEncounter(campaignId: string, mapId?: string, mapName?: string): Promise<Encounter> {
  const id = mapId ?? (await createEncounterMap(campaignId, mapName)).id;
  const view = readMapView(id);
  const spot = view ? { ...view.centre } : { x: 0, y: 0 };
  if (view && view.pxPerSquare < BATTLE_PX_PER_SQUARE) writeMapView(id, { centre: spot, pxPerSquare: BATTLE_PX_PER_SQUARE });
  return { ...newEncounter(campaignId), mapId: id, spot };
}

/** Saves the Encounter and drops its Map's Tokens whose Combatant is gone (so removal works from any panel or window). */
export async function saveEncounter(e: Encounter): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["encounters", "maps"], "readwrite");
  await tx.objectStore("encounters").put(e as unknown as CollectionRecord);
  const map = e.mapId ? ((await tx.objectStore("maps").get(e.mapId)) as MapRecord | undefined) : undefined;
  const alive = new Set(e.combatants.map((c) => c.id));
  if (map?.tokens.some((t) => t.combatantId && !alive.has(t.combatantId))) {
    const next = { ...map, tokens: map.tokens.filter((t) => !t.combatantId || alive.has(t.combatantId)), updatedAt: Date.now() };
    await tx.objectStore("maps").put(next as unknown as CollectionRecord);
  }
  await tx.done;
}

/** Ends the Encounter. Its Tokens (the ones linked to its Combatants, defeated ones too) are removed from its Map,
 *  or with `keepTokens` stay as free Tokens keeping their last name. Free Tokens the DM placed by hand always stay. */
export async function endEncounter(campaignId: string, { keepTokens = false }: { keepTokens?: boolean } = {}): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["encounters", "maps"], "readwrite");
  const rows = (await tx.objectStore("encounters").index("byCampaign").getAll(campaignId)) as unknown as Row[];
  for (const r of rows) {
    await tx.objectStore("encounters").delete(r.id);
    const map = r.mapId ? ((await tx.objectStore("maps").get(r.mapId)) as MapRecord | undefined) : undefined;
    if (!map?.tokens.some((t) => t.combatantId)) continue;
    const tokens = map.tokens.flatMap((t) => {
      if (!t.combatantId) return [t];
      if (!keepTokens) return [];
      const c = r.combatants.find((x) => x.id === t.combatantId);
      const { combatantId: _drop, ...free } = t;
      return [{ ...free, name: c?.name ?? t.name }];
    });
    await tx.objectStore("maps").put({ ...map, tokens, updatedAt: Date.now() } as unknown as CollectionRecord);
  }
  await tx.done;
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
