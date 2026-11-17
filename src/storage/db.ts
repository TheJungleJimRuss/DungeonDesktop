import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from "idb";
import { notifyChange } from "../sync/changeBus";

/** Per-Campaign collections. Later tickets add records to these stores; the
 *  stores already exist so no schema migration is needed to start using them. */
export const COLLECTIONS = ["party", "npcs", "locations", "sessions", "notes", "customEntries", "encounters", "savedEncounters", "edges", "battleMaps"] as const;
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
  edges: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
  battleMaps: { key: string; value: CollectionRecord; indexes: { byCampaign: string } };
}

export const DB_NAME = "dungeon-desktop";
export const DB_VERSION = 6;

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

let dbPromise: Promise<IDBPDatabase<DungeonDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<DungeonDB>> {
  dbPromise ??= openDB<DungeonDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Creates only what is missing, so each version bump (v2 added customEntries, v3 encounters, v4 savedEncounters, v5 edges, v6 battleMaps) upgrades older databases.
      if (!db.objectStoreNames.contains("campaigns")) db.createObjectStore("campaigns", { keyPath: "id" });
      for (const name of COLLECTIONS) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" }).createIndex("byCampaign", "campaignId");
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
