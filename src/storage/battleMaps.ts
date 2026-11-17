import { useEffect, useState } from "react";
import { getDb, type CollectionRecord } from "./db";
import { useChangeVersion } from "../sync/changeBus";
import { MAX_IMAGE_SIDE, resizeImage } from "./imageResize";

/** A token on the Battle Map. `x`/`y` are grid squares (0-based). A token with a `combatantId` is linked: it shows that Combatant's name (`name` is only the last copy) and goes when the Combatant does. */
export interface Token { id: string; name: string; color: string; x: number; y: number; combatantId?: string; }
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
/** Background image: lives right on the map (so it goes with the map and any saved copy; no separate store to orphan).
 *  `scale` multiplies the grid size (1 = fits the grid); offsets are in squares. `imageId` and `opacity` are reserved. */
export interface MapBackground { image?: StoredImage; imageId?: string; opacity?: number; offsetX?: number; offsetY?: number; scale?: number; }
/** One map per Encounter. The record id IS the encounterId, so there can never be two. */
export interface BattleMap {
  id: string; campaignId: string; encounterId: string;
  width: number; height: number; feetPerSquare: number;
  tokens: Token[]; background?: MapBackground;
}
/** The copy kept inside a saved encounter: no ids that belong to the old Encounter. */
export type SavedMap = Pick<BattleMap, "width" | "height" | "feetPerSquare" | "background"> & { tokens: (Omit<Token, "combatantId"> & { link?: string })[] };

export const DEFAULT_WIDTH = 20, DEFAULT_HEIGHT = 20, DEFAULT_FEET = 5, MAX_SQUARES = 60;
export const clampInt = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

export const defaultMap = (campaignId: string, encounterId: string): BattleMap => ({
  id: encounterId, campaignId, encounterId, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, feetPerSquare: DEFAULT_FEET, tokens: [],
});

/** The stored map, or undefined if the DM never touched it. */
export async function getBattleMap(encounterId: string): Promise<BattleMap | undefined> {
  return (await (await getDb()).get("battleMaps", encounterId)) as unknown as BattleMap | undefined;
}

/** Read-modify-write one map (created from defaults on first change). Tokens are kept inside the grid. */
export async function updateBattleMap(campaignId: string, encounterId: string, change: (m: BattleMap) => BattleMap): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("battleMaps", "readwrite");
  const row = (await tx.store.get(encounterId)) as unknown as BattleMap | undefined;
  const next = change(row ?? defaultMap(campaignId, encounterId));
  next.tokens = next.tokens.map((t) => ({ ...t, x: clampInt(t.x, 0, next.width - 1), y: clampInt(t.y, 0, next.height - 1) }));
  await tx.store.put(next as unknown as CollectionRecord);
  await tx.done;
}

/** `linkOf` turns a Combatant id into a key that survives Load (see combat/saved.ts linkKeyOf). */
export const snapshotMap = (m: BattleMap, linkOf?: (combatantId: string) => string | undefined): SavedMap => ({
  width: m.width, height: m.height, feetPerSquare: m.feetPerSquare,
  tokens: m.tokens.map(({ name, color, x, y, combatantId }) => {
    const link = combatantId ? linkOf?.(combatantId) : undefined;
    return { id: crypto.randomUUID(), name, color, x, y, ...(link ? { link } : {}) };
  }),
  ...(m.background ? { background: m.background } : {}),
});

/** `resolve` maps a saved link key to the recreated Combatant's id; a token whose link cannot be resolved comes back free. */
export async function restoreMap(campaignId: string, encounterId: string, s: SavedMap, resolve?: (link: string) => string | undefined): Promise<void> {
  const tokens: Token[] = s.tokens.map(({ link, ...t }) => {
    const combatantId = link ? resolve?.(link) : undefined;
    return { ...t, id: crypto.randomUUID(), ...(combatantId ? { combatantId } : {}) };
  });
  const row: BattleMap = { ...s, id: encounterId, campaignId, encounterId, tokens };
  await (await getDb()).put("battleMaps", row as unknown as CollectionRecord);
}

export const TOKEN_COLORS: Record<string, string> = { party: "#2980b9", monster: "#c0392b", adhoc: "#7f8c8d" };

/** One new token per Combatant that has none (lair entries are not bodies on the map), on free squares. */
export function withCombatantTokens(m: BattleMap, combatants: { id: string; kind: string; name: string }[]): BattleMap {
  const placed = new Set(m.tokens.map((t) => t.combatantId));
  const tokens = [...m.tokens];
  for (const c of combatants) {
    if (c.kind === "lair" || placed.has(c.id)) continue;
    const spot = freeSquare({ ...m, tokens });
    tokens.push({ id: crypto.randomUUID(), name: c.name, color: TOKEN_COLORS[c.kind] ?? TOKEN_COLORS.adhoc, combatantId: c.id, ...spot });
  }
  return { ...m, tokens };
}

/** First empty square, scanning row by row, so a new token never lands on another. */
export function freeSquare(m: BattleMap) {
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (!m.tokens.some((t) => t.x === x && t.y === y)) return { x, y };
  return { x: 0, y: 0 };
}

/** Live map for an Encounter (defaults until the DM changes something). */
export function useBattleMap(campaignId: string, encounterId: string): BattleMap {
  const version = useChangeVersion("battleMaps");
  const [row, setRow] = useState<BattleMap>();
  useEffect(() => {
    let live = true;
    void getBattleMap(encounterId).then((r) => live && setRow(r));
    return () => { live = false; };
  }, [encounterId, version]);
  return row?.encounterId === encounterId ? row : defaultMap(campaignId, encounterId);
}
