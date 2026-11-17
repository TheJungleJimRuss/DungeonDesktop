import { useMemo, useSyncExternalStore } from "react";
import { notifyChange, onChange } from "../sync/changeBus";
import { getPoppedPanels, setPoppedPanels } from "./popoutState";

/** Which NPCs are pinned to the Pop-out Window, per Campaign, in pin order. Same storage pattern as the NPC selection:
 *  localStorage + change bus + `storage` event, with an in-memory fallback. The stored value is a JSON array of ids;
 *  an older build stored one bare id, which still reads as a one-item list. */
export const PINNED_NPC_PANEL = "pinned-npc";
const key = (campaignId: string) => `dungeon-desktop:npc-pin:${campaignId}`;
const topic = (campaignId: string) => `npc-pin:${campaignId}`;
const memory = new Map<string, string>();

function readRaw(campaignId: string): string {
  try { return localStorage.getItem(key(campaignId)) ?? memory.get(campaignId) ?? ""; } catch { return memory.get(campaignId) ?? ""; }
}
export function parsePins(raw: string): string[] {
  if (!raw) return [];
  if (raw.startsWith("[")) {
    try { const v = JSON.parse(raw); return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string"))] : []; } catch { return []; }
  }
  return [raw]; // old single-id value
}
export const getPinnedNpcs = (campaignId: string) => parsePins(readRaw(campaignId));

function writePins(campaignId: string, ids: string[]): void {
  const raw = ids.length ? JSON.stringify(ids) : "";
  memory.set(campaignId, raw);
  try { if (raw) localStorage.setItem(key(campaignId), raw); else localStorage.removeItem(key(campaignId)); } catch { /* in-memory only */ }
  notifyChange(topic(campaignId));
}

/** Adds the NPC at the end of the list; already pinned is a no-op. */
export function pinNpc(campaignId: string, npcId: string): void {
  const ids = getPinnedNpcs(campaignId);
  if (!ids.includes(npcId)) writePins(campaignId, [...ids, npcId]);
}

export function usePinnedNpcIds(campaignId: string): string[] {
  const subscribe = (cb: () => void) => {
    const off = onChange(topic(campaignId), cb);
    const onStorage = (e: StorageEvent) => { if (e.key === key(campaignId)) cb(); };
    window.addEventListener("storage", onStorage);
    return () => { off(); window.removeEventListener("storage", onStorage); };
  };
  const raw = useSyncExternalStore(subscribe, () => readRaw(campaignId)); // the string is the stable snapshot
  return useMemo(() => parsePins(raw), [raw]);
}

/** Unpinning removes the NPC; when it was the last one the panel leaves the Pop-out Window's list (the window itself stays until its last panel goes). */
export function unpinNpc(campaignId: string, npcId: string): void {
  const rest = getPinnedNpcs(campaignId).filter((id) => id !== npcId);
  writePins(campaignId, rest);
  if (rest.length === 0) setPoppedPanels(campaignId, getPoppedPanels(campaignId).filter((p) => p !== PINNED_NPC_PANEL));
}
