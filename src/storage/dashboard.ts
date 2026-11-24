import { useEffect, useState } from "react";
import { useChangeVersion } from "../sync/changeBus";
import { DASHBOARD_DEFAULT } from "../modes/modes";
import { DASHBOARD_COLUMNS, DASHBOARD_MIN_H, DASHBOARD_MIN_W, DASHBOARD_NEW_H, DASHBOARD_NEW_W, SCALE_X, SCALE_Y, packLegacy, repairOverlaps } from "../modes/dashboardLayout";
import { hasPanel } from "../panels/registry";
import { getDb, type CampaignRecord, type DashboardEntry, type StoredDashboard } from "./db";

export type { DashboardEntry };

/** Panel ids that were replaced by another panel: saved layouts naming them show the new one. */
const RENAMED_PANELS: Record<string, string> = { "world-map": "map", "battle-map": "map" };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const whole = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback);

/** Cleans a stored Dashboard: drops entries without a usable panel id (and, with `isKnown`, unknown ids) and repeats,
 *  rounds and clamps positions and sizes into the 120-column grid (minimum 30 x 24), and pushes overlapping panels down
 *  (never up: gaps stay). Accepts the current object `{ grid: "fine", panels }`, a plain list of revision 2 entries
 *  (12 columns, scaled up) or a plain list of revision 1 entries (width/height, no x: packed in order, then scaled).
 *  Returns undefined when the value is none of these (meaning "use the default"). */
export function normalizeDashboard(raw: unknown, isKnown: (id: string) => boolean = () => true): StoredDashboard | undefined {
  const fine = isObject(raw) && raw.grid === "fine" && Array.isArray(raw.panels);
  const list = fine ? (raw as { panels: unknown[] }).panels : raw;
  if (!Array.isArray(list)) return undefined;
  const seen = new Set<string>();
  const items: Record<string, unknown>[] = [];
  for (const raw of list) {
    const e = isObject(raw) && typeof raw.panelId === "string" && raw.panelId in RENAMED_PANELS ? { ...raw, panelId: RENAMED_PANELS[raw.panelId] } : raw;
    if (!isObject(e) || typeof e.panelId !== "string" || !e.panelId || seen.has(e.panelId) || !isKnown(e.panelId)) continue;
    seen.add(e.panelId);
    items.push(e);
  }
  const old = !fine; // older shapes are in 12-column units
  const legacy = new Map(packLegacy(old ? items.filter((e) => typeof e.x !== "number").map((e) => e as { panelId: string }) : []).map((e) => [e.panelId, e]));
  const entries = items.map((e): DashboardEntry => {
    const packed = legacy.get(e.panelId as string);
    const [kx, ky] = old ? [SCALE_X, SCALE_Y] : [1, 1];
    const src = packed ?? e;
    const w = Math.min(DASHBOARD_COLUMNS, Math.max(DASHBOARD_MIN_W, whole(src.w, DASHBOARD_NEW_W / kx) * kx));
    return {
      panelId: e.panelId as string,
      w,
      h: Math.max(DASHBOARD_MIN_H, whole(src.h, DASHBOARD_NEW_H / ky) * ky),
      x: Math.min(DASHBOARD_COLUMNS - w, Math.max(0, whole(src.x, 0) * kx)),
      y: Math.max(0, whole(src.y, 0) * ky),
    };
  });
  return { grid: "fine", panels: repairOverlaps(entries) };
}

/** The Dashboard the Campaign shows: its own arrangement, or the default when it has none. */
export function readDashboard(stored: unknown): DashboardEntry[] {
  return normalizeDashboard(stored, hasPanel)?.panels ?? DASHBOARD_DEFAULT;
}

/** Saves the Dashboard arrangement; `null` removes it so the Campaign follows the default again. Bumps updatedAt so "Update campaigns from files" never overwrites a newer layout with an older export. */
export async function setDashboard(id: string, entries: DashboardEntry[] | null): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("campaigns", "readwrite");
  const existing = await tx.store.get(id);
  if (existing) {
    const { dashboard: _old, ...rest } = existing;
    const updatedAt = Date.now();
    await tx.store.put(entries ? { ...rest, updatedAt, dashboard: { grid: "fine", panels: entries } } : { ...rest, updatedAt });
  }
  await tx.done;
}

/** The Dashboard of a Campaign, re-read whenever Campaigns change (also from another window). */
export function useDashboard(campaign: CampaignRecord): DashboardEntry[] {
  const { id } = campaign;
  const version = useChangeVersion("campaigns");
  // Seed from the record already in hand so a customized Dashboard never flashes the default first.
  const [entries, setEntries] = useState<DashboardEntry[]>(() => readDashboard(campaign.dashboard));
  useEffect(() => {
    let live = true;
    void getDb().then((db) => db.get("campaigns", id)).then((c) => live && setEntries(readDashboard(c?.dashboard)));
    return () => { live = false; };
  }, [id, version]);
  return entries;
}
