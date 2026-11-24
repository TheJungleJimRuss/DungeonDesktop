import { useEffect, useState } from "react";
import { getDb, type CollectionRecord } from "./db";
import { onChange } from "../sync/changeBus";
import { MAX_IMAGE_SIDE, resizeImage } from "./imageResize";

/** The image bytes plus MIME type. Kept as an ArrayBuffer (not a Blob) because that clones identically everywhere, including fake-indexeddb in tests where a jsdom Blob clones to `{}`; the panel wraps it in a Blob for display. */
export interface StoredImage { type: string; data: ArrayBuffer; }
const readBytes = (f: Blob): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as ArrayBuffer);
  r.onerror = () => reject(r.error);
  r.readAsArrayBuffer(f);
});
/** Bytes of a chosen file, downscaled to MAX_IMAGE_SIDE on the longest side; the original when it is small enough or cannot be resized. */
export async function toStoredImage(f: Blob): Promise<StoredImage> {
  try {
    const small = await resizeImage(f, MAX_IMAGE_SIDE);
    if (small) return small;
  } catch { /* undecodable or no canvas support: keep the file as chosen */ }
  return { type: f.type, data: await readBytes(f) };
}
/** Background image: lives right on the Map (so it goes with the Map; no separate store to orphan).
 *  `scale` multiplies the Map's size (1 = fits the Map); offsets are in squares. `imageId` and `opacity` are reserved. */
export interface MapBackground { image?: StoredImage; imageId?: string; opacity?: number; offsetX?: number; offsetY?: number; scale?: number; }

export type MapUnit = "ft" | "mi";
export type SegmentKind = "plain" | "wall" | "door";
export interface MapPoint { x: number; y: number; }
/** A drawn Line (later tickets). `segments[i]` describes points i to i+1; a closed Line has one more (last back to first). */
export interface MapLine {
  id: string; points: MapPoint[]; closed: boolean; segments: SegmentKind[]; route?: true;
  area?: { kind: string; color: string; name?: string; locationId?: string };
}
export interface MapMarker { id: string; x: number; y: number; name: string; color: string; icon: string; note: string; locationId?: string; }
/** A Token. `x`/`y` are whole squares. A Token with a `combatantId` is linked: it shows that Combatant's name (`name` is only the last copy) and goes when the Combatant does. */
export interface MapToken { id: string; name: string; color: string; x: number; y: number; combatantId?: string; }

/** One Map: a named, scaled grid with an optional background. Everything lives on the one record, so a Map is one read-modify-write and one sync event. */
export interface MapRecord extends CollectionRecord {
  name: string;
  unit: MapUnit;
  /** What one square is worth, in `unit`. */
  perSquare: number;
  showGrid: boolean;
  /** Size in squares. */
  width: number;
  height: number;
  background?: MapBackground;
  lines: MapLine[];
  markers: MapMarker[];
  tokens: MapToken[];
  /** The optional Party Token (at most one): whole squares. Dropping it on a linked Marker or Area sets the Campaign's party location. */
  partyToken?: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
}

export const MAP_DEFAULT_WIDTH = 20, MAP_DEFAULT_HEIGHT = 20, MAP_MAX_SQUARES = 200;
export const clampSquares = (v: number) => Math.min(MAP_MAX_SQUARES, Math.max(1, Math.round(v)));

export async function listMaps(campaignId: string): Promise<MapRecord[]> {
  const rows = (await (await getDb()).getAllFromIndex("maps", "byCampaign", campaignId)) as MapRecord[];
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.createdAt - b.createdAt);
}

/** Creates a Map with the defaults (20 x 20 squares, 5 ft, grid on). A blank name becomes "Map N". */
export async function createMap(campaignId: string, name?: string): Promise<MapRecord> {
  const existing = await listMaps(campaignId);
  const now = Date.now();
  let n = existing.length + 1;
  while (!name?.trim() && existing.some((m) => m.name === `Map ${n}`)) n++;
  const map = newMapRecord(campaignId, name?.trim() || `Map ${n}`, now);
  await (await getDb()).add("maps", map);
  return map;
}

/** A blank Map: 20 x 20 squares, 5 ft, grid on. */
export const newMapRecord = (campaignId: string, name: string, now = Date.now()): MapRecord => ({
  id: crypto.randomUUID(), campaignId, name, unit: "ft", perSquare: 5, showGrid: true,
  width: MAP_DEFAULT_WIDTH, height: MAP_DEFAULT_HEIGHT, lines: [], markers: [], tokens: [], createdAt: now, updatedAt: now,
});

/** A Location row without the map position old versions kept (`x`/`y`): the Map holds positions now (as Markers). Same row when it has none. */
export function stripLocationPosition<T extends object>(row: T): T {
  if (!("x" in row) && !("y" in row)) return row;
  const { x: _x, y: _y, ...rest } = row as T & { x?: unknown; y?: unknown };
  return rest as T;
}

/** Gives every Encounter without a `mapId` its own blank Map (named "Encounter N", clear of the Campaign's `existing` Map names and each other).
 *  Returns the Encounters with their `mapId` set and the new Maps to store. Used by the database upgrade and by importing an old export. */
export function withEncounterMaps<E extends { campaignId: string; mapId?: string }>(encounters: E[], existing: { campaignId: string; name: string }[], now = Date.now()): { encounters: E[]; maps: MapRecord[] } {
  const maps: MapRecord[] = [];
  const out = encounters.map((e) => {
    if (e.mapId) return e;
    const names = [...existing, ...maps].filter((m) => m.campaignId === e.campaignId);
    const map = newMapRecord(e.campaignId, encounterMapName(names), now);
    maps.push(map);
    return { ...e, mapId: map.id };
  });
  return { encounters: out, maps };
}

export async function getMap(id: string): Promise<MapRecord | undefined> {
  return (await (await getDb()).get("maps", id)) as MapRecord | undefined;
}

/** A name for an Encounter's blank Map: `base` if free, else "base 2", ...; with no base, "Encounter 1", "Encounter 2", ... */
export function encounterMapName(existing: { name: string }[], base?: string): string {
  const taken = new Set(existing.map((m) => m.name));
  if (base?.trim() && !taken.has(base.trim())) return base.trim();
  const stem = base?.trim() || "Encounter";
  for (let n = base?.trim() ? 2 : 1; ; n++) if (!taken.has(`${stem} ${n}`)) return `${stem} ${n}`;
}

/** Creates the blank Map an Encounter is played on when the DM picks none (named after the Encounter / saved encounter). */
export async function createEncounterMap(campaignId: string, base?: string): Promise<MapRecord> {
  return createMap(campaignId, encounterMapName(await listMaps(campaignId), base));
}

/** Read-modify-write one Map; a Map that no longer exists is left alone. Token positions are rounded to whole squares. */
export async function updateMap(id: string, change: (m: MapRecord) => MapRecord): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("maps", "readwrite");
  const row = (await tx.store.get(id)) as MapRecord | undefined;
  if (row) {
    const next = change(row);
    // Tokens always sit on whole squares (even with the grid hidden); the Map has no edge for them, so they may lie outside width x height.
    const tokens = next.tokens.map((t) => ({ ...t, x: Math.round(t.x), y: Math.round(t.y) }));
    const partyToken = next.partyToken && { x: Math.round(next.partyToken.x), y: Math.round(next.partyToken.y) };
    await tx.store.put({ ...next, tokens, ...(partyToken ? { partyToken } : {}), updatedAt: Date.now() });
  }
  await tx.done;
}

export async function deleteMap(id: string): Promise<void> {
  await (await getDb()).delete("maps", id);
}

/** Live list of a Campaign's Maps (also from another window). `undefined` while loading. */
export function useMaps(campaignId: string): MapRecord[] | undefined {
  const [rows, setRows] = useState<MapRecord[]>();
  useEffect(() => {
    let live = true;
    const load = () => void listMaps(campaignId).then((r) => live && setRows(r));
    load();
    const off = onChange("maps", load);
    return () => { live = false; off(); };
  }, [campaignId]);
  return rows;
}

/* ---- This device only: the last viewed Map per Campaign, and the zoom/pan per Map. ---- */
const lastKey = (campaignId: string) => `dungeon-desktop:map-last:${campaignId}`;
export function readLastMapId(campaignId: string): string | null {
  try { return localStorage.getItem(lastKey(campaignId)); } catch { return null; }
}
export function writeLastMapId(campaignId: string, mapId: string): void {
  try { localStorage.setItem(lastKey(campaignId), mapId); } catch { /* not saved */ }
}

export interface MapView { zoom: number; centre: { x: number; y: number }; }
const viewKey = (mapId: string) => `dungeon-desktop:map-view:${mapId}`;
/** The saved zoom and centre (in squares) for a Map, or null for the fit view. */
export function readMapView(mapId: string): MapView | null {
  try {
    const v = JSON.parse(localStorage.getItem(viewKey(mapId)) ?? "null");
    if ([v?.zoom, v?.x, v?.y].every((n) => typeof n === "number" && Number.isFinite(n)) && v.zoom > 0) return { zoom: v.zoom, centre: { x: v.x, y: v.y } };
  } catch { /* no saved view */ }
  return null;
}
export function writeMapView(mapId: string, view: MapView | null): void {
  try {
    if (view) localStorage.setItem(viewKey(mapId), JSON.stringify({ zoom: view.zoom, x: view.centre.x, y: view.centre.y }));
    else localStorage.removeItem(viewKey(mapId));
  } catch { /* not saved */ }
}

/* ---- Tokens ---- */
export const TOKEN_COLORS: Record<string, string> = { party: "#2980b9", monster: "#c0392b", adhoc: "#7f8c8d" };
type Board = Pick<MapRecord, "width" | "height" | "tokens">;

/** One new Token per Combatant that has none (lair entries are not bodies on the Map), on free squares. */
export function withCombatantTokens<M extends Board>(m: M, combatants: { id: string; kind: string; name: string }[]): M {
  const placed = new Set(m.tokens.map((t) => t.combatantId));
  const tokens = [...m.tokens];
  for (const c of combatants) {
    if (c.kind === "lair" || placed.has(c.id)) continue;
    const spot = sideSquare({ ...m, tokens }, c.kind === "party" ? "left" : "right");
    tokens.push({ id: crypto.randomUUID(), name: c.name, color: TOKEN_COLORS[c.kind] ?? TOKEN_COLORS.adhoc, combatantId: c.id, ...spot });
  }
  return { ...m, tokens };
}

/** Party lines up down the left edge one square in; everyone else lines up six squares (30 ft on a 5 ft grid) further
 *  right, so the sides start apart but both are in view. A full column moves on to the next one. Falls back to the first empty square. */
export function sideSquare(m: Board, side: "left" | "right") {
  const inset = m.width >= 4 ? 1 : 0, top = m.height >= 4 ? 1 : 0;
  const free = (x: number, y: number) => !m.tokens.some((t) => t.x === x && t.y === y);
  const start = side === "left" ? inset : Math.min(m.width - 1 - inset, inset + 6);
  for (let x = start; x < m.width; x++) {
    for (let y = top; y < m.height; y++) if (free(x, y)) return { x, y };
  }
  return freeSquare(m);
}

/** First empty square, scanning row by row, so a new Token never lands on another. */
export function freeSquare(m: Board) {
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (!m.tokens.some((t) => t.x === x && t.y === y)) return { x, y };
  return { x: 0, y: 0 };
}

/** A Token as kept in a saved encounter: position, name and colour, and a link key (see combat/saved.ts linkKeyOf) instead of a Combatant id. */
export interface SavedToken { name: string; color: string; x: number; y: number; link: string; }

/** The Map's linked Tokens as saved tokens. `linkOf` turns a Combatant id into a key that survives Load; Tokens without a key are left out. */
export function snapshotTokens(m: Pick<MapRecord, "tokens">, linkOf: (combatantId: string) => string | undefined): SavedToken[] {
  return m.tokens.flatMap(({ name, color, x, y, combatantId }) => {
    const link = combatantId ? linkOf(combatantId) : undefined;
    return link ? [{ name, color, x, y, link }] : [];
  });
}

/** Puts a saved encounter's Tokens on the Map, linked to the recreated Combatants (`resolve` maps a link key to a Combatant id; unresolved ones are skipped).
 *  Existing Tokens already linked to those Combatants are replaced, and so are free Tokens left standing on the same square under the same name
 *  (what ending the earlier fight left behind), so loading twice never stacks them. Combatants still without a Token are lined up on the sides. */
export function restoreTokens<M extends MapRecord>(m: M, saved: SavedToken[], resolve: (link: string) => string | undefined, combatants: { id: string; kind: string; name: string }[]): M {
  const added = saved.flatMap(({ link, ...t }) => {
    const combatantId = resolve(link);
    return combatantId ? [{ ...t, id: crypto.randomUUID(), combatantId }] : [];
  });
  const linked = new Set(added.map((t) => t.combatantId));
  const kept = m.tokens.filter((t) => !(t.combatantId && linked.has(t.combatantId)) && !(!t.combatantId && added.some((a) => a.x === t.x && a.y === t.y && a.name === t.name)));
  return withCombatantTokens({ ...m, tokens: [...kept, ...added] }, combatants);
}
