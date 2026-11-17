import { useSyncExternalStore } from "react";
import { notifyChange, onChange } from "../sync/changeBus";

/** Which panels of a Campaign are popped out. Remembered per Campaign in localStorage
 *  (so it survives reloads) and shared with the Pop-out Window via the change bus plus
 *  the `storage` event. */
export const POPOUT_CHANGE = "popouts";
const key = (campaignId: string) => `dungeon-desktop:popouts:${campaignId}`;
const memory = new Map<string, string>();

function readRaw(campaignId: string): string {
  try { return localStorage.getItem(key(campaignId)) ?? memory.get(campaignId) ?? "[]"; } catch { return memory.get(campaignId) ?? "[]"; }
}
export const parsePanels = (raw: string): string[] => {
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
};
export const getPoppedPanels = (campaignId: string) => parsePanels(readRaw(campaignId));

export function setPoppedPanels(campaignId: string, panels: string[]): void {
  const raw = JSON.stringify([...new Set(panels)]);
  memory.set(campaignId, raw);
  try { localStorage.setItem(key(campaignId), raw); } catch { /* in-memory only */ }
  notifyChange(POPOUT_CHANGE);
}

/** Raw JSON string is the snapshot so useSyncExternalStore sees a stable value. */
export function usePoppedPanelsRaw(campaignId: string): string {
  const subscribe = (cb: () => void) => {
    const off = onChange(POPOUT_CHANGE, cb);
    const onStorage = (e: StorageEvent) => { if (e.key === key(campaignId)) cb(); };
    window.addEventListener("storage", onStorage);
    return () => { off(); window.removeEventListener("storage", onStorage); };
  };
  return useSyncExternalStore(subscribe, () => readRaw(campaignId));
}
