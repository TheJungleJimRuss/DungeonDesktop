import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type DungeonDB } from "./db";
import { exportCampaignFrom, type CampaignExport } from "./portability";

/** Opens the existing database at the version it has, never upgrading it; null when there is none yet. */
async function openUnchanged(): Promise<IDBPDatabase<DungeonDB> | null> {
  // A raw probe first: opening without a version creates a database that is missing, which this must not do (and idb would report the abort as an unhandled rejection).
  const exists = await new Promise<boolean>((resolve) => {
    const req = indexedDB.open(DB_NAME);
    let fresh = false;
    req.onupgradeneeded = () => { fresh = true; req.transaction?.abort(); };
    req.onsuccess = () => { req.result.close(); resolve(!fresh); };
    req.onerror = (e) => { e.preventDefault(); resolve(false); };
    req.onblocked = () => resolve(false);
  });
  return exists ? openDB<DungeonDB>(DB_NAME) : null;
}

/** Does this device still hold Maps from before the endless Map (spec 0009)? The v9 upgrade deletes them, so the app asks first. */
export async function hasOldMaps(): Promise<boolean> {
  const db = await openUnchanged();
  if (!db) return false;
  try {
    return db.version < DB_VERSION && db.objectStoreNames.contains("maps") && (await db.count("maps")) > 0;
  } finally {
    db.close();
  }
}

/** One export per Campaign that has old Maps, read from the database before it is upgraded. */
export async function exportOldMapCampaigns(): Promise<CampaignExport[]> {
  const db = await openUnchanged();
  if (!db) return [];
  try {
    const ids = new Set((await db.getAll("maps")).map((m) => m.campaignId));
    const out: CampaignExport[] = [];
    for (const id of ids) {
      const data = await exportCampaignFrom(db, id);
      if (data) out.push(data);
    }
    return out;
  } finally {
    db.close();
  }
}
