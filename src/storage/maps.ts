import { useEffect, useState } from "react";
import { getDb, type CollectionRecord } from "./db";
import { onChange } from "../sync/changeBus";
import { battleView, clampPxPerSquare } from "../map/scale";

export type SegmentKind = "plain" | "wall" | "door";
export interface MapPoint { x: number; y: number; }
/** A drawn Line (later tickets). `segments[i]` describes points i to i+1; a closed Line has one more (last back to first). */
export interface MapLine {
  id: string; points: MapPoint[]; closed: boolean; segments: SegmentKind[]; route?: true;
  /** Present when the Shape is an Area. `holes`: parts cut out of it (rings of points in squares, strictly inside the outline, not overlapping); absent = none. */
  /** `priority`: how far out its label stays (absent: normal). */
  area?: { kind: string; color: string; name?: string; locationId?: string; holes?: MapPoint[][]; priority?: AreaPriority };
}
export interface MapMarker { id: string; x: number; y: number; name: string; color: string; icon: string; note: string; locationId?: string;
  /** Pixels per square when it was placed (absent: battle scale, 32). */ placedAt?: number;
  /** How far out it stays visible (absent: normal). */ priority?: MarkerPriority; }
export type MarkerPriority = "minor" | "normal" | "major" | "always";
/** Normal: the label hides once the Area is narrower on screen than the text. Medium: it hides once the Area is narrower than half the text. High: the label stays while the Area is drawn.
 *  Highest: after the Area fades, a dot and the label stay until it is 10x further out. Always: the label (with a dot) stays at every zoom. */
export type AreaPriority = "normal" | "medium" | "high" | "highest" | "always";
/** An Area's Priority as stored, reading the old "major" (before High/Highest, 2026-11-26) as "high". */
export const areaPriorityOf = (area: { priority?: string } | undefined): AreaPriority =>
  area?.priority === "major" ? "high" : (area?.priority as AreaPriority | undefined) ?? "normal";
/** A Token. `x`/`y` are whole squares. A Token with a `combatantId` is linked: it shows that Combatant's name (`name` is only the last copy) and goes when the Combatant does. */
export interface MapToken { id: string; name: string; color: string; x: number; y: number; combatantId?: string; }

/** One Map: a named, endless canvas on a fixed 5 ft base square (ADR 0003): coordinates are base squares, unbounded and possibly negative.
 *  Everything lives on the one record, so a Map is one read-modify-write and one sync event. */
export interface MapRecord extends CollectionRecord {
  name: string;
  showGrid: boolean;
  /** Snap to grid (absent: on). Off: drawing, Area drags and the ruler use the free pointer. Drawing and Area drags never snap while the grid is hidden. */
  snapToGrid?: boolean;
  lines: MapLine[];
  markers: MapMarker[];
  tokens: MapToken[];
  /** The optional Party Token (at most one): whole squares. Dropping it on a linked Marker or Area sets the Campaign's party location. */
  partyToken?: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
}

export async function listMaps(campaignId: string): Promise<MapRecord[]> {
  const rows = (await (await getDb()).getAllFromIndex("maps", "byCampaign", campaignId)) as MapRecord[];
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.createdAt - b.createdAt);
}

/** Creates a blank Map (grid on). A blank name becomes "Map N". */
export async function createMap(campaignId: string, name?: string): Promise<MapRecord> {
  const existing = await listMaps(campaignId);
  const now = Date.now();
  let n = existing.length + 1;
  while (!name?.trim() && existing.some((m) => m.name === `Map ${n}`)) n++;
  const map = newMapRecord(campaignId, name?.trim() || `Map ${n}`, now);
  await (await getDb()).add("maps", map);
  return map;
}

/** A blank Map: grid on, nothing drawn. */
export const newMapRecord = (campaignId: string, name: string, now = Date.now()): MapRecord => ({
  id: crypto.randomUUID(), campaignId, name, showGrid: true, lines: [], markers: [], tokens: [], createdAt: now, updatedAt: now,
});

/** Maps from before the endless Map (spec 0009) carry a scale and a size; they are deleted by the upgrade and skipped by import. */
export const isOldShapeMap = (m: object): boolean => "perSquare" in m || "width" in m;

/** A Location row without the map position old versions kept (`x`/`y`): the Map holds positions now (as Markers). Same row when it has none. */
export function stripLocationPosition<T extends object>(row: T): T {
  if (!("x" in row) && !("y" in row)) return row;
  const { x: _x, y: _y, ...rest } = row as T & { x?: unknown; y?: unknown };
  return rest as T;
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
    // Tokens always sit on whole squares (even with the grid hidden).
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

/** The view: centre in base squares, and on-screen pixels per base square. */
export interface MapView { centre: { x: number; y: number }; pxPerSquare: number; }
const viewKey = (mapId: string) => `dungeon-desktop:map-view:${mapId}`;
/** The saved view for a Map on this device, clamped to the zoom limits, or null (open at battle scale at (0, 0)). Views saved before spec 0009 are ignored. */
export function readMapView(mapId: string): MapView | null {
  try {
    const v = JSON.parse(localStorage.getItem(viewKey(mapId)) ?? "null");
    if ([v?.pxPerSquare, v?.x, v?.y].every((n) => typeof n === "number" && Number.isFinite(n)) && v.pxPerSquare > 0) return { centre: { x: v.x, y: v.y }, pxPerSquare: clampPxPerSquare(v.pxPerSquare) };
  } catch { /* no saved view */ }
  return null;
}
/** The saved view, or battle scale at (0, 0). */
export const readMapViewOrDefault = (mapId: string): MapView => readMapView(mapId) ?? battleView();
/** Views are written by the Map panel on every change, so the stored view IS the current one: other code (starting an Encounter) reads it with readMapView.
 *  A write from outside the panel is announced here so a mounted panel adopts it. */
const viewListeners = new Set<(mapId: string, view: MapView) => void>();
export function onMapViewWrite(fn: (mapId: string, view: MapView) => void): () => void {
  viewListeners.add(fn);
  return () => { viewListeners.delete(fn); };
}
export function writeMapView(mapId: string, view: MapView | null): void {
  if (view) viewListeners.forEach((fn) => fn(mapId, view));
  try {
    if (view) localStorage.setItem(viewKey(mapId), JSON.stringify({ pxPerSquare: view.pxPerSquare, x: view.centre.x, y: view.centre.y }));
    else localStorage.removeItem(viewKey(mapId));
  } catch { /* not saved */ }
}

/* ---- Tokens ---- */
export const TOKEN_COLORS: Record<string, string> = { party: "#2980b9", monster: "#c0392b", adhoc: "#7f8c8d" };
type Board = Pick<MapRecord, "tokens">;

/** One new Token per Combatant that has none (lair entries are not bodies on the Map), on free squares. */
export function withCombatantTokens<M extends Board>(m: M, combatants: { id: string; kind: string; name: string }[], spot?: Spot): M {
  const placed = new Set(m.tokens.map((t) => t.combatantId));
  const tokens = [...m.tokens];
  for (const c of combatants) {
    if (c.kind === "lair" || placed.has(c.id)) continue;
    const at = sideSquare({ ...m, tokens }, c.kind === "party" ? "left" : "right", spot);
    tokens.push({ id: crypto.randomUUID(), name: c.name, color: TOKEN_COLORS[c.kind] ?? TOKEN_COLORS.adhoc, combatantId: c.id, ...at });
  }
  return { ...m, tokens };
}

/** Party lines up down a column one square right of the start point, everyone else six squares (30 ft) further right, so the sides start apart
 *  but both are in view at battle scale. A full column (6 squares, all inside a battle-scale view) moves on to the next one. */
export function sideSquare(m: Board, side: "left" | "right", spot?: Spot) {
  const { x: ox, y: oy } = origin(spot);
  const free = (x: number, y: number) => !m.tokens.some((t) => t.x === x && t.y === y);
  const start = side === "left" ? 1 : 7;
  for (let x = ox + start; x < ox + start + 50; x++) for (let y = oy + 1; y <= oy + 6; y++) if (free(x, y)) return { x, y };
  return freeSquare(m, spot);
}
/** A point in squares (an Encounter's spot, the view centre). Tokens sit on whole squares, so searches start at the nearest one. */
type Spot = { x: number; y: number };
const origin = (spot?: Spot) => ({ x: Math.round(spot?.x ?? 0), y: Math.round(spot?.y ?? 0) });

/** First empty square, scanning row by row from the spot (default (0, 0)) eight squares across, so a new Token never lands on another. */
export function freeSquare(m: Board, spot?: Spot) {
  const o = origin(spot);
  for (let y = o.y; ; y++) for (let x = o.x; x < o.x + 8; x++) if (!m.tokens.some((t) => t.x === x && t.y === y)) return { x, y };
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
export function restoreTokens<M extends MapRecord>(m: M, saved: SavedToken[], resolve: (link: string) => string | undefined, combatants: { id: string; kind: string; name: string }[], spot?: Spot): M {
  const added = saved.flatMap(({ link, ...t }) => {
    const combatantId = resolve(link);
    return combatantId ? [{ ...t, id: crypto.randomUUID(), combatantId }] : [];
  });
  const linked = new Set(added.map((t) => t.combatantId));
  const kept = m.tokens.filter((t) => !(t.combatantId && linked.has(t.combatantId)) && !(!t.combatantId && added.some((a) => a.x === t.x && a.y === t.y && a.name === t.name)));
  return withCombatantTokens({ ...m, tokens: [...kept, ...added] }, combatants, spot);
}
