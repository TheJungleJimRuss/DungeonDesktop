import { useEffect, useState, useSyncExternalStore } from "react";
import { getDb, type CollectionRecord } from "./db";
import { onChange } from "../sync/changeBus";
import { notifyNpcsChanged, type Npc } from "./npcs";
import type { MapRecord } from "./maps";
import { unlinkLocationFromLines } from "../map/areas";
import { unlinkLocationFromMarkers } from "../map/markers";

/** What kind of place a location is. Each gets its own color. */
export const LOCATION_TYPES = [
  { id: "city", label: "City", color: "#5b7cff" },
  { id: "town", label: "Town", color: "#3cc4c4" },
  { id: "village", label: "Village", color: "#7bd15e" },
  { id: "wilderness", label: "Wilderness", color: "#d4a64a" },
  { id: "dungeon", label: "Dungeon", color: "#e0596a" },
  { id: "landmark", label: "Landmark", color: "#c27bff" },
  { id: "other", label: "Other", color: "#8a92c0" },
] as const;
export type LocationType = (typeof LOCATION_TYPES)[number]["id"];
export const DEFAULT_LOCATION_TYPE: LocationType = "other";

/** The type entry for a location (old records without a type count as "other"). */
export function locationTypeOf(l: { type?: string }) {
  return LOCATION_TYPES.find((t) => t.id === l.type) ?? LOCATION_TYPES[LOCATION_TYPES.length - 1];
}

/** A place, stored in the `locations` collection. Scenes and NPCs link by `locationId`. */
export interface Location extends CollectionRecord {
  name: string;
  notes: string;
  type?: LocationType;
  /** Starred locations can be filtered to. */
  starred?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LocationDraft {
  name: string;
  notes: string;
  type?: LocationType;
}

const listeners = new Set<() => void>();
const changed = () => { listeners.forEach((l) => l()); notifyNpcsChanged(); };

export async function listLocations(campaignId: string): Promise<Location[]> {
  const rows = (await (await getDb()).getAllFromIndex("locations", "byCampaign", campaignId)) as Location[];
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createLocation(campaignId: string, draft: LocationDraft): Promise<Location> {
  const now = Date.now();
  const loc: Location = { ...draft, id: crypto.randomUUID(), campaignId, createdAt: now, updatedAt: now };
  await (await getDb()).add("locations", loc);
  changed();
  return loc;
}

/** Edits a location. Renaming also updates the tag of every NPC linked to it. */
export async function updateLocation(id: string, patch: Partial<LocationDraft>): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["locations", "npcs"], "readwrite");
  const existing = (await tx.objectStore("locations").get(id)) as Location | undefined;
  if (existing) {
    const next = { ...existing, ...patch, updatedAt: Date.now() };
    await tx.objectStore("locations").put(next);
    if (patch.name !== undefined && patch.name !== existing.name) {
      const npcs = tx.objectStore("npcs");
      for (const n of (await npcs.index("byCampaign").getAll(existing.campaignId)) as Npc[]) {
        if (n.locationId === id) await npcs.put({ ...n, locationTag: next.name, updatedAt: Date.now() });
      }
    }
  }
  await tx.done;
  changed();
}

/** Stars or unstars a location. */
export async function setLocationStarred(id: string, starred: boolean): Promise<void> {
  const db = await getDb();
  const existing = (await db.get("locations", id)) as Location | undefined;
  if (!existing) return;
  const { starred: _old, ...rest } = existing;
  await db.put("locations", starred ? { ...rest, starred: true } : rest);
  changed();
}

/** Deletes a location. Its NPCs are unlinked but keep the old name as free-text tag; so do the Areas and Markers on Maps. */
export async function deleteLocation(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["locations", "npcs", "campaigns", "maps"], "readwrite");
  const existing = (await tx.objectStore("locations").get(id)) as Location | undefined;
  if (existing) {
    const campaigns = tx.objectStore("campaigns");
    const camp = await campaigns.get(existing.campaignId);
    if (camp?.partyLocationId === id) {
      const { partyLocationId: _gone, ...rest } = camp;
      await campaigns.put(rest);
    }
    const npcs = tx.objectStore("npcs");
    for (const n of (await npcs.index("byCampaign").getAll(existing.campaignId)) as Npc[]) {
      if (n.locationId === id) {
        const { locationId: _gone, ...rest } = n;
        await npcs.put({ ...rest, updatedAt: Date.now() });
      }
    }
    // Areas and Markers on this Campaign's Maps that link here keep the old name as their own text.
    const maps = tx.objectStore("maps");
    for (const m of (await maps.index("byCampaign").getAll(existing.campaignId)) as MapRecord[]) {
      const lines = unlinkLocationFromLines(m.lines, id, existing.name);
      const markers = unlinkLocationFromMarkers(m.markers, id, existing.name);
      if (lines !== m.lines || markers !== m.markers) await maps.put({ ...m, lines, markers, updatedAt: Date.now() });
    }
    await tx.objectStore("locations").delete(id);
  }
  await tx.done;
  changed();
}

/** Links an NPC to a location (tag = its name), or unlinks it (no location, empty tag). */
export async function setNpcLocation(npcId: string, location: Location | null): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("npcs", "readwrite");
  const n = (await tx.store.get(npcId)) as Npc | undefined;
  if (n) {
    const { locationId: _old, ...rest } = n;
    await tx.store.put(
      location
        ? { ...rest, locationId: location.id, locationTag: location.name, updatedAt: Date.now() }
        : { ...rest, locationTag: "", updatedAt: Date.now() },
    );
  }
  await tx.done;
  changed();
}

/** Live list of a Campaign's locations. `undefined` while loading. */
export function useLocations(campaignId: string): Location[] | undefined {
  const [rows, setRows] = useState<Location[]>();
  useEffect(() => {
    let live = true;
    const load = () => void listLocations(campaignId).then((r) => live && setRows(r));
    load();
    listeners.add(load);
    const off = onChange("locations", load); // changes made in another window
    return () => { live = false; listeners.delete(load); off(); };
  }, [campaignId]);
  return rows;
}

/* ---- Selection: which location the view panel shows (per Campaign, like NPC selection). ---- */
const selKey = (campaignId: string) => `dungeon-desktop:location-selection:${campaignId}`;
const readSel = (campaignId: string): string | null => {
  try { return localStorage.getItem(selKey(campaignId)); } catch { return null; }
};
const memory = new Map<string, string | null>();

export function selectLocation(campaignId: string, id: string | null): void {
  memory.set(campaignId, id);
  try {
    if (id) localStorage.setItem(selKey(campaignId), id); else localStorage.removeItem(selKey(campaignId));
  } catch { /* in-memory only */ }
  listeners.forEach((l) => l());
}

export function useSelectedLocationId(campaignId: string): string | null {
  const subscribe = (cb: () => void) => {
    const onStorage = (e: StorageEvent) => { if (e.key === selKey(campaignId)) cb(); };
    listeners.add(cb);
    window.addEventListener("storage", onStorage);
    return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
  };
  return useSyncExternalStore(subscribe, () => readSel(campaignId) ?? memory.get(campaignId) ?? null);
}
