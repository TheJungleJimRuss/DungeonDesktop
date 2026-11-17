import { useSyncExternalStore } from "react";
import { notifyChange, onChange } from "../sync/changeBus";

/** Which combatant the Combatant Stat Block panel shows when the DM picked one in the tracker, per Campaign.
 *  The pick remembers whose turn it was, so it lapses when the turn moves on (the panel then follows the active
 *  combatant again). Kept like srd/selection.ts: localStorage, synced to other tabs, memory fallback. */
export interface CombatPick { combatantId: string; activeId?: string }
const key = (campaignId: string) => `dungeon-desktop:combat-pick:${campaignId}`;
const topic = (campaignId: string) => `combat-pick:${campaignId}`;
const memory = new Map<string, string | null>();

function read(campaignId: string): string | null {
  try { return localStorage.getItem(key(campaignId)); } catch { return memory.get(campaignId) ?? null; }
}

export function pickCombatant(campaignId: string, pick: CombatPick | null) {
  const raw = pick ? JSON.stringify(pick) : null;
  memory.set(campaignId, raw);
  try { if (raw) localStorage.setItem(key(campaignId), raw); else localStorage.removeItem(key(campaignId)); } catch { /* memory only */ }
  notifyChange(topic(campaignId));
}

export function useCombatPick(campaignId: string): CombatPick | null {
  const raw = useSyncExternalStore((cb) => onChange(topic(campaignId), cb), () => read(campaignId));
  if (!raw) return null;
  try { return JSON.parse(raw) as CombatPick; } catch { return null; }
}
