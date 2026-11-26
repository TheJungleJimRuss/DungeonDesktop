import type { MapLine } from "../storage/maps";
import { filledArea, pointInArea, type Pt } from "./geometry";

export const DEFAULT_AREA_KIND = "Area", DEFAULT_AREA_COLOR = "#3498db";

/** The Area whose fill contains `p` (inside the outline and in none of its Holes); where several overlap, the smallest wins, counting each
 *  Area's size without its Holes. Only closed Lines with an `area` count. */
export function areaAt(lines: MapLine[], p: Pt): MapLine | undefined {
  let best: MapLine | undefined, bestSize = Infinity;
  for (const l of lines) {
    if (!l.area || !l.closed || !pointInArea(p, l.points, l.area.holes)) continue;
    const size = filledArea(l.points, l.area.holes);
    if (size < bestSize) { best = l; bestSize = size; }
  }
  return best;
}

/** What an Area is called on the Map: the linked Location's live name, else its own name, else its kind. */
export function areaLabel(area: NonNullable<MapLine["area"]>, locationName?: string): string {
  return locationName?.trim() || area.name?.trim() || area.kind;
}

/** Areas linked to a deleted Location become unlinked and keep the old name as their own (unless they had one). Returns the same array when nothing links. */
export function unlinkLocationFromLines(lines: MapLine[], locationId: string, oldName: string): MapLine[] {
  if (!lines.some((l) => l.area?.locationId === locationId)) return lines;
  return lines.map((l) => {
    if (l.area?.locationId !== locationId) return l;
    const { locationId: _gone, ...area } = l.area;
    return { ...l, area: { ...area, name: area.name?.trim() ? area.name : oldName } };
  });
}

/** The Line with one point moved to `at`: point `index` of the outline, or of Hole `hole` of its Area when given. */
export function movePoint(l: MapLine, hole: number | undefined, index: number, at: Pt): MapLine {
  const set = (pts: Pt[]) => pts.map((p, i) => (i === index ? at : p));
  if (hole === undefined) return { ...l, points: set(l.points) };
  if (!l.area?.holes) return l;
  return { ...l, area: { ...l.area, holes: l.area.holes.map((h, k) => (k === hole ? set(h) : h)) } };
}

/** The Line with `f` applied to every point: the outline's and, for an Area, its Holes' (used for drags and the anchor conversion). */
export function mapLinePoints(l: MapLine, f: (p: Pt) => Pt): MapLine {
  const points = l.points.map(f);
  if (!l.area?.holes) return { ...l, points };
  return { ...l, points, area: { ...l.area, holes: l.area.holes.map((h) => h.map(f)) } };
}
