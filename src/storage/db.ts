import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from "idb";
import { notifyChange } from "../sync/changeBus";
import { stripLocationPosition } from "./maps";

/** Per-Campaign collections. Later tickets add records to these stores; the
 *  stores already exist so no schema migration is needed to start using them. */
export const COLLECTIONS = ["party", "npcs", "locations", "sessions", "notes", "customEntries", "encounters", "savedEncounters", "maps"] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export interface CampaignRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Id of the Mode the DM last used in this Campaign (see src/modes). Optional: no migration needed. */
  lastMode?: string;
  /** Id of the Location where the Party currently is. Optional: old records have none. */
  partyLocationId?: string;
  /** The DM's own Dashboard arrangement (grid positions). Missing = the default Dashboard. */
  dashboard?: StoredDashboard;
}

/** One panel on the Dashboard grid (120 columns of about 8 px, 8 px rows; x, y, w, h in grid units). */
export interface DashboardEntry {
  panelId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What a Campaign stores for its Dashboard. `grid: "fine"` marks the 120-column grid (older shapes are plain lists). */
export interface StoredDashboard {
  grid: "fine";
  panels: DashboardEntry[];
}

/** Every collection record belongs to exactly one Campaign. */
export interface CollectionRecord {
  id: string;
  campaignId: string;
  [field: string]: unknown;
}

export interface DungeonDB extends DBSchema {
  campaigns: { key: string; value: CampaignRecord };
  party: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
  npcs: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
  locations: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
  sessions: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
  notes: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
  customEntries: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
  encounters: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
  savedEncounters: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
  maps: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
}

export const DB_NAME = "dungeon-desktop";
export const DB_VERSION = 9;

const WRITES = new Set(["add", "put", "delete", "clear"]);

/** Wraps the connection so every write path announces itself on the change bus
 *  (see sync/changeBus.ts): direct add/put/delete/clear and readwrite transactions. */
function withChangeNotifications(db: IDBPDatabase<DungeonDB>): IDBPDatabase<DungeonDB> {
  const names = (stores: unknown) => (Array.isArray(stores) ? stores : [stores]) as string[];
  const doneOf = new WeakMap<object, Promise<void>>();
  return new Proxy(db, {
    get(target, prop) {
      const value = (target as never)[prop];
      if (typeof value !== "function") return value;
      if (typeof prop === "string" && WRITES.has(prop)) {
        return async (store: string, ...args: unknown[]) => {
          const result = await (value as (...a: unknown[]) => unknown).call(target, store, ...args);
          notifyChange(store);
          return result;
        };
      }
      if (prop === "transaction") {
        return (stores: unknown, mode?: string, options?: unknown) => {
          const tx = (value as (...a: unknown[]) => IDBPTransaction<DungeonDB, never, "readwrite">).call(target, stores, mode, options);
          if (mode !== "readwrite") return tx;
          return new Proxy(tx, {
            get(t, p) {
              const v = (t as never)[p];
              if (p === "done") {
                let done = doneOf.get(t);
                if (!done) {
                  done = (v as Promise<void>).then(() => names(stores).forEach(notifyChange));
                  doneOf.set(t, done);
                }
                return done;
              }
              return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
            },
          });
        };
      }
      return (value as (...a: unknown[]) => unknown).bind(target);
    },
  });
}

/** This device's last-Map and Map-view keys point at deleted Maps after the v9 upgrade. */
function clearMapDeviceKeys(): void {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("dungeon-desktop:map-last:") || key.startsWith("dungeon-desktop:map-view:")) localStorage.removeItem(key);
  } catch { /* no storage here */ }
}

let dbPromise: Promise<IDBPDatabase<DungeonDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<DungeonDB>> {
  dbPromise ??= openDB<DungeonDB>(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      // Creates only what is missing, so each version bump (v2 added customEntries, v3 encounters, v4 savedEncounters, v5 edges, v6 battleMaps, v7 maps; v8 drops battleMaps again) upgrades older databases.
      if (!db.objectStoreNames.contains("campaigns")) db.createObjectStore("campaigns", { keyPath: "id" });
      for (const name of COLLECTIONS) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" }).createIndex("byCampaign", "campaignId");
      }
      if (oldVersion > 0 && oldVersion < 7) {
        // v7 (ADR 0002): the World Map's edges are gone and Locations no longer carry a map position.
        const old = db as unknown as IDBPDatabase;
        if (old.objectStoreNames.contains("edges")) old.deleteObjectStore("edges");
        let cursor = await tx.objectStore("locations").openCursor();
        while (cursor) {
          const rest = stripLocationPosition(cursor.value);
          if (rest !== cursor.value) await cursor.update(rest);
          cursor = await cursor.continue();
        }
      }
      if (oldVersion > 0 && oldVersion < 8) {
        // v8 (spec 0007): the Battle Map store is gone and saved encounters keep no map copy.
        const old = db as unknown as IDBPDatabase;
        if (old.objectStoreNames.contains("battleMaps")) old.deleteObjectStore("battleMaps");
        let saved = await tx.objectStore("savedEncounters").openCursor();
        while (saved) {
          if ("map" in saved.value) { const { map: _map, ...rest } = saved.value; await saved.update(rest as typeof saved.value); }
          saved = await saved.continue();
        }
      }
      if (oldVersion > 0 && oldVersion < 9) {
        // v9 (spec 0009, ADR 0003): Maps are endless on a fixed 5 ft square, and old ones are not converted. Every Map goes, along with the Map links
        // (and Tokens) on Encounters and saved encounters; everything else stays. The app warned the DM first (src/ui/OldMapsNotice.tsx).
        await tx.objectStore("maps").clear();
        for (const name of ["encounters", "savedEncounters"] as const) {
          let cursor = await tx.objectStore(name).openCursor();
          while (cursor) {
            if ("mapId" in cursor.value || "tokens" in cursor.value || "spot" in cursor.value) {
              const { mapId: _m, tokens: _t, spot: _s, ...rest } = cursor.value;
              await cursor.update(rest as typeof cursor.value);
            }
            cursor = await cursor.continue();
          }
        }
        clearMapDeviceKeys();
      }
    },
  }).then(withChangeNotifications);
  return dbPromise;
}

/** Close and forget the cached connection (used by tests when swapping the factory). */
export function closeDb(): void {
  dbPromise?.then((db) => db.close()).catch(() => {});
  dbPromise = null;
}
