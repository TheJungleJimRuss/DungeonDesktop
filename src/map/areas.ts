import type { MapLine } from "../storage/maps";
import { pointInPolygon, polygonArea, type Pt } from "./geometry";

export const DEFAULT_AREA_KIND = "Area", DEFAULT_AREA_COLOR = "#3498db";

/** The Area containing `p`; where several overlap, the smallest wins. Only closed Lines with an `area` count. */
export function areaAt(lines: MapLine[], p: Pt): MapLine | undefined {
  let best: MapLine | undefined, bestSize = Infinity;
  for (const l of lines) {
    if (!l.area || !l.closed || !pointInPolygon(p, l.points)) continue;
    const size = polygonArea(l.points);
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
