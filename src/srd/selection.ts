import { useSyncExternalStore } from "react";
import { notifyChange, onChange } from "../sync/changeBus";
import type { RefType } from "./reference";

/** Which monster the Stat Block panel shows, per Campaign. Kept in localStorage (shared with the Pop-out Window
 *  via the change bus) with an in-memory fallback where storage is unavailable. */
const key = (campaignId: string) => `dungeon-desktop:statblock-selection:${campaignId}`;
const topic = (campaignId: string) => `statblock-selection:${campaignId}`;
const memory = new Map<string, string | null>();

function read(campaignId: string): string | null {
  try { return localStorage.getItem(key(campaignId)); } catch { return memory.get(campaignId) ?? null; }
}

export function selectStatBlock(campaignId: string, monsterId: string | null) {
  memory.set(campaignId, monsterId);
  try {
    if (monsterId) localStorage.setItem(key(campaignId), monsterId); else localStorage.removeItem(key(campaignId));
  } catch { /* in-memory only */ }
  notifyChange(topic(campaignId));
}

export function useSelectedStatBlock(campaignId: string): string | null {
  return useSyncExternalStore((cb) => onChange(topic(campaignId), cb), () => read(campaignId));
}

/** Selection ids: a bare id is an SRD monster, `custom:<id>` a custom entry, `ref:<type>:<id>` any other SRD entry. */
export const REF_PREFIX = "ref:";
export function selectionIdOf(hit: { type: RefType; entry: { id: string } }): string {
  return hit.type === "monster" ? hit.entry.id : `${REF_PREFIX}${hit.type}:${hit.entry.id}`;
}
export function parseRefSelection(id: string): { type: RefType; id: string } | null {
  if (!id.startsWith(REF_PREFIX)) return null;
  const rest = id.slice(REF_PREFIX.length);
  const i = rest.indexOf(":");
  return i < 0 ? null : { type: rest.slice(0, i) as RefType, id: rest.slice(i + 1) };
}
