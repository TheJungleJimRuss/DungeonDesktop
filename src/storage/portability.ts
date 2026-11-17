import type { StoredImage } from "./battleMaps";
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
  for (const name of ["battleMaps", "savedEncounters"] as const) {
    collections[name] = await Promise.all(collections[name].map((r) => convertImage(name, r, (v) => (isStored(v) ? toDataUrl(v) : v))));
  }
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: Date.now(), campaign, collections };
}

// Blobs do not survive JSON, so a map's background image travels as a data URL (map rows and the maps inside saved encounters).
const mapOf = (name: string, row: CollectionRecord) => (name === "battleMaps" ? row : name === "savedEncounters" ? (row as { map?: unknown }).map : undefined) as { background?: { image?: unknown } } | undefined;

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
async function convertImage(name: string, row: CollectionRecord, convert: (v: unknown) => Promise<unknown> | unknown): Promise<CollectionRecord> {
  const map = mapOf(name, row);
  const img = map?.background?.image;
  if (!map || img === undefined) return row;
  const background = { ...map.background, image: await convert(img) };
  return (name === "battleMaps" ? { ...row, background } : { ...row, map: { ...map, background } }) as CollectionRecord;
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
  for (const name of ["battleMaps", "savedEncounters"] as const) {
    collections[name] = await Promise.all((collections[name] ?? []).map((r) => convertImage(name, r, (v) => (typeof v === "string" ? fromDataUrl(v) : v))));
  }
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
