import type { DashboardEntry } from "../storage/db";

/** The fine grid: 120 columns, 8 px rows. Revision 1 and 2 layouts used 12 columns and 40 px rows (see the scale factors). */
export const DASHBOARD_COLUMNS = 120;
export const DASHBOARD_MIN_W = 30;
export const DASHBOARD_MIN_H = 24;
/** Size of a newly added panel, and the fallback for a stored entry with no usable size. */
export const DASHBOARD_NEW_W = 60;
export const DASHBOARD_NEW_H = 48;
/** Revision 2 units to fine units: x and w by 10 (12 to 120 columns), y and h by 6 (a 40 px row plus its 8 px margin is 48 px = 6 fine rows). */
export const SCALE_X = 10;
export const SCALE_Y = 6;
const LEGACY_COLUMNS = 12;

// Revision 1 stored an ordered list with a width and a height instead of positions.
const SPAN = { third: 4, half: 6, "two-thirds": 8, full: 12 } as const;
const ROWS = { normal: 1, tall: 2 } as const;
const ROWS_PER_UNIT = 5; // one revision 1 row (normal) = 5 grid rows; tall = 10

/** Converts revision 1 entries (width/height, in order) to grid entries: each goes to the first free spot
 *  (top to bottom, left to right) that fits, in order, never overlapping. */
export function packLegacy(entries: { panelId: string; width?: unknown; height?: unknown }[]): DashboardEntry[] {
  const taken = new Set<string>();
  const free = (col: number, row: number, w: number, h: number) => {
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) if (taken.has(`${r},${c}`)) return false;
    return true;
  };
  return entries.map((e) => {
    const w = SPAN[e.width as keyof typeof SPAN] ?? 6;
    const rows = ROWS[e.height as keyof typeof ROWS] ?? 1;
    for (let row = 0; ; row++) {
      for (let col = 0; col + w <= LEGACY_COLUMNS; col++) {
        if (!free(col, row, w, rows)) continue;
        for (let r = row; r < row + rows; r++) for (let c = col; c < col + w; c++) taken.add(`${r},${c}`);
        return { panelId: e.panelId, x: col, y: row * ROWS_PER_UNIT, w, h: rows * ROWS_PER_UNIT };
      }
    }
  });
}

const overlaps = (a: DashboardEntry, b: DashboardEntry) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Removes overlaps and nothing else: in (y, x) order each panel is pushed down just below whatever it overlaps.
 *  Nothing moves up and gaps stay. Result is in that (y, x) order. */
export function repairOverlaps(entries: DashboardEntry[]): DashboardEntry[] {
  const placed: DashboardEntry[] = [];
  for (const e of [...entries].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const item = { ...e };
    let hit: DashboardEntry | undefined;
    while ((hit = placed.find((p) => overlaps(item, p)))) item.y = hit.y + hit.h;
    placed.push(item);
  }
  return placed;
}

/** The layout during a drag or resize: `moved` stays exactly where it is, every other panel goes back to its spot in
 *  `start` (the layout when the drag began) and is pushed down only as far as it is still in the way. So a panel that
 *  was pushed returns as soon as nothing covers its spot. Nothing moves above its start spot and gaps stay. */
export function settleAround(start: DashboardEntry[], moved: DashboardEntry): DashboardEntry[] {
  const placed: DashboardEntry[] = [{ ...moved }];
  const others = start.filter((e) => e.panelId !== moved.panelId).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const e of others) {
    const item = { ...e };
    let hit: DashboardEntry | undefined;
    while ((hit = placed.find((p) => overlaps(item, p)))) item.y = hit.y + hit.h;
    placed.push(item);
  }
  return placed;
}
