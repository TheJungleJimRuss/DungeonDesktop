import { stripLocationPosition, withEncounterMaps, type MapRecord, type StoredImage } from "./maps";
import { normalizeDashboard } from "./dashboard";
import { COLLECTIONS, getDb, type CampaignRecord, type CollectionName, type CollectionRecord } from "./db";

export const EXPORT_FORMAT = "dungeon-desktop-campaign";
export const EXPORT_VERSION = 1;

export interface CampaignExport {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: number;
  campaign: CampaignRecord;
  collections: Record<CollectionName, CollectionRecord[]>;
}

export type ParseResult = { ok: true; data: CampaignExport } | { ok: false; error: string };

/** Builds the export document: the Campaign record plus every per-Campaign collection. */
export async function exportCampaign(id: string): Promise<CampaignExport | undefined> {
  const db = await getDb();
  const tx = db.transaction(["campaigns", ...COLLECTIONS], "readonly");
  const campaign = await tx.objectStore("campaigns").get(id);
  if (!campaign) return undefined;
  const collections = {} as Record<CollectionName, CollectionRecord[]>;
  for (const name of COLLECTIONS) collections[name] = await tx.objectStore(name).index("byCampaign").getAll(id);
  await tx.done;
  for (const name of ["maps"] as const) {
    collections[name] = await Promise.all(collections[name].map((r) => convertImage(r, (v) => (isStored(v) ? toDataUrl(v) : v))));
  }
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: Date.now(), campaign, collections };
}

// Old exports may carry `edges` and `battleMaps` collections: only COLLECTIONS names are read, so they are ignored (as is the `map` copy in a saved encounter, dropped on import).
// Blobs do not survive JSON, so a Map's background image travels as a data URL.

const isStored = (v: unknown): v is StoredImage => typeof v === "object" && v !== null && typeof (v as StoredImage).type === "string" && typeof (v as StoredImage).data?.byteLength === "number";
function toDataUrl(img: StoredImage): string {
  const bytes = new Uint8Array(img.data);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${img.type};base64,${btoa(bin)}`;
}
function fromDataUrl(url: string): StoredImage | undefined {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!m) return undefined;
  const raw = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  return { type: m[1], data: Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer };
}
/** Returns a copy of the row with the background image converted by `convert` (rows without one come back as they are). */
async function convertImage(row: CollectionRecord, convert: (v: unknown) => Promise<unknown> | unknown): Promise<CollectionRecord> {
  const map = row as { background?: { image?: unknown } };
  const img = map.background?.image;
  if (img === undefined) return row;
  return { ...row, background: { ...map.background, image: await convert(img) } } as CollectionRecord;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Validates file text as a Campaign export. Never throws. */
export function parseCampaignFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON, so it cannot be imported." };
  }
  if (!isObject(raw) || raw.format !== EXPORT_FORMAT) {
    return { ok: false, error: "This file is not a Dungeon Desktop campaign export." };
  }
  if (raw.version !== EXPORT_VERSION) {
    return {
      ok: false,
      error: `Unsupported export version ${String(raw.version)}. This site can import version ${EXPORT_VERSION}.`,
    };
  }
  const c = raw.campaign;
  if (
    !isObject(c) ||
    typeof c.id !== "string" || !c.id ||
    typeof c.name !== "string" ||
    typeof c.createdAt !== "number" ||
    typeof c.updatedAt !== "number"
  ) {
    return { ok: false, error: "The campaign in this file is missing required details." };
  }
  const rawCollections = raw.collections ?? {};
  if (!isObject(rawCollections)) return { ok: false, error: "The collections in this file are malformed." };
  const collections = {} as Record<CollectionName, CollectionRecord[]>;
  for (const name of COLLECTIONS) {
    const rows = rawCollections[name] ?? [];
    if (!Array.isArray(rows)) return { ok: false, error: `The "${name}" data in this file is malformed.` };
    for (const row of rows) {
      if (!isObject(row) || typeof row.id !== "string" || !row.id || row.campaignId !== c.id) {
        return { ok: false, error: `The "${name}" data in this file is malformed.` };
      }
    }
    collections[name] = rows as CollectionRecord[];
  }
  const { dashboard: rawDashboard, ...rest } = c as unknown as CampaignRecord;
  // A damaged Dashboard never blocks an import; unknown panel ids are dropped when it is read.
  const dashboard = normalizeDashboard(rawDashboard);
  const campaign: CampaignRecord = dashboard ? { ...rest, dashboard } : rest;
  return { ok: true, data: { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: Number(raw.exportedAt) || 0, campaign, collections } };
}

export async function campaignExists(id: string): Promise<boolean> {
  return (await (await getDb()).get("campaigns", id)) !== undefined;
}

/** Writes the Campaign, replacing any existing Campaign with the same id (and its collection rows). */
export async function importCampaign(data: CampaignExport): Promise<CampaignRecord> {
  const collections = { ...data.collections };
  for (const name of ["maps"] as const) {
    collections[name] = await Promise.all((collections[name] ?? []).map((r) => convertImage(r, (v) => (typeof v === "string" ? fromDataUrl(v) : v))));
  }
  // Saved encounters used to carry a copy of their Battle Map; it is ignored now (they keep a mapId and token list instead).
  collections.savedEncounters = (collections.savedEncounters ?? []).map(({ map: _map, ...row }) => row as CollectionRecord);
  // Older exports: Locations carried a map position, and an Encounter in progress had no Map.
  collections.locations = (collections.locations ?? []).map(stripLocationPosition);
  const withMaps = withEncounterMaps((collections.encounters ?? []) as unknown as { campaignId: string; mapId?: string }[], (collections.maps ?? []) as unknown as MapRecord[]);
  collections.encounters = withMaps.encounters as unknown as CollectionRecord[];
  collections.maps = [...(collections.maps ?? []), ...(withMaps.maps as unknown as CollectionRecord[])];
  data = { ...data, collections };
  const db = await getDb();
  const tx = db.transaction(["campaigns", ...COLLECTIONS], "readwrite");
  const id = data.campaign.id;
  // Refuse (before changing anything) to clobber rows that belong to a different Campaign.
  for (const name of COLLECTIONS) {
    const store = tx.objectStore(name);
    for (const row of data.collections[name]) {
      const existing = await store.get(row.id);
      if (existing && existing.campaignId !== id) throw new Error("A record in this file clashes with another campaign.");
    }
  }
  for (const name of COLLECTIONS) {
    const store = tx.objectStore(name);
    for (const key of await store.index("byCampaign").getAllKeys(id)) await store.delete(key);
    for (const row of data.collections[name]) await store.put(row);
  }
  await tx.objectStore("campaigns").put(data.campaign);
  await tx.done;
  return data.campaign;
}

export interface UpdateSummary {
  updated: string[];
  /** Existing campaigns whose file was not newer than the stored campaign. */
  upToDate: string[];
  /** Files with no matching campaign, or that could not be read: "file name: reason". */
  skipped: string[];
}

/**
 * Updates existing Campaigns from exported JSON files. A file replaces the Campaign with the same id only
 * when it was exported after the Campaign was last updated; files with no matching Campaign are skipped.
 */
export async function updateCampaignsFromFiles(files: { name: string; text: string }[]): Promise<UpdateSummary> {
  const summary: UpdateSummary = { updated: [], upToDate: [], skipped: [] };
  for (const file of files) {
    const parsed = parseCampaignFile(file.text);
    if (!parsed.ok) {
      summary.skipped.push(`${file.name}: ${parsed.error}`);
      continue;
    }
    const existing = await (await getDb()).get("campaigns", parsed.data.campaign.id);
    if (!existing) {
      summary.skipped.push(`${file.name}: no campaign with this id exists here`);
    } else if (parsed.data.exportedAt <= existing.updatedAt) {
      summary.upToDate.push(existing.name);
    } else {
      try {
        const saved = await importCampaign(parsed.data);
        summary.updated.push(saved.name);
      } catch (e) {
        summary.skipped.push(`${file.name}: ${e instanceof Error ? e.message : "update failed"}`);
      }
    }
  }
  return summary;
}
