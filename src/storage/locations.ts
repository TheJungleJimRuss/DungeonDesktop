import { useEffect, useState, useSyncExternalStore } from "react";
import { getDb, type CollectionRecord } from "./db";
import { onChange } from "../sync/changeBus";
import type { Edge } from "./edges";
import { notifyNpcsChanged, type Npc } from "./npcs";

/** How big a place is: its marker radius on the World Map, in map units. Also decides how far
 *  the map can zoom out before the place turns into a bare point (bigger places hold out longer). */
export const DEFAULT_LOCATION_SIZE = 14;
export const MIN_LOCATION_SIZE = 3;
export const MAX_LOCATION_SIZE = 200;
const LEGACY_SIZES: Record<string, number> = { tiny: 8, small: 11, medium: 14, large: 19, huge: 25 };
/** A location's size as a number (older records stored a size word). */
export function locationSizeOf(l: { size?: number | string }): number {
  const n = typeof l.size === "number" ? l.size : LEGACY_SIZES[l.size ?? ""] ?? DEFAULT_LOCATION_SIZE;
  return Math.min(MAX_LOCATION_SIZE, Math.max(MIN_LOCATION_SIZE, n));
}

/** What kind of place a location is. Each gets its own color on the World Map. */
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

/** A World Map node, stored in the `locations` collection. `x`/`y` are its World Map
 *  position (unset until dragged). Edges live in their own `edges` collection (storage/edges.ts).
 *  Scenes link by `locationId`. */
export interface Location extends CollectionRecord {
  name: string;
  notes: string;
  type?: LocationType;
  size?: number;
  /** Starred locations are marked on the World Map and can be filtered to. */
  starred?: boolean;
  x?: number;
  y?: number;
  createdAt: number;
  updatedAt: number;
}

export interface LocationDraft {
  name: string;
  notes: string;
  type?: LocationType;
  size?: number;
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

/** Saves a node's World Map position. */
export async function setLocationPosition(id: string, x: number, y: number): Promise<void> {
  const db = await getDb();
  const existing = (await db.get("locations", id)) as Location | undefined;
  if (existing) await db.put("locations", { ...existing, x, y });
}

/** Deletes a location (and every edge touching it). Its NPCs are unlinked but keep the old name as free-text tag. */
export async function deleteLocation(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["locations", "npcs", "edges", "campaigns"], "readwrite");
  const existing = (await tx.objectStore("locations").get(id)) as Location | undefined;
  if (existing) {
    const campaigns = tx.objectStore("campaigns");
    const camp = await campaigns.get(existing.campaignId);
    if (camp?.partyLocationId === id) {
      const { partyLocationId: _gone, ...rest } = camp;
      await campaigns.put(rest);
    }
    const edges = tx.objectStore("edges");
    for (const e of (await edges.index("byCampaign").getAll(existing.campaignId)) as unknown as Edge[]) {
      if (e.fromId === id || e.toId === id) await edges.delete(e.id);
    }
    const npcs = tx.objectStore("npcs");
    for (const n of (await npcs.index("byCampaign").getAll(existing.campaignId)) as Npc[]) {
      if (n.locationId === id) {
        const { locationId: _gone, ...rest } = n;
        await npcs.put({ ...rest, updatedAt: Date.now() });
      }
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
