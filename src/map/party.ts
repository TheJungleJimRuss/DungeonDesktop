import type { MapRecord } from "../storage/maps";
import { areaAt } from "./areas";
import { hitsPoint, type Pt } from "./geometry";
import { HIT_PX } from "./lines";

/** The Location the Party Token stands at: a Marker linked to a Location within the hit radius (nearest wins), else the smallest linked Area
 *  containing the point. A Marker beats an Area. `pxPerUnit` is screen pixels per square. Undefined when the point is on neither. */
export function partyLocationAt(map: Pick<MapRecord, "lines" | "markers">, p: Pt, pxPerUnit: number): string | undefined {
  let best: { id: string; d: number } | undefined;
  for (const k of map.markers) {
    if (!k.locationId || !hitsPoint(p, k, pxPerUnit, HIT_PX)) continue;
    const d = Math.hypot(p.x - k.x, p.y - k.y);
    if (!best || d < best.d) best = { id: k.locationId, d };
  }
  if (best) return best.id;
  return areaAt(map.lines.filter((l) => l.area?.locationId), p)?.area?.locationId;
}

/** The Location a Party Token standing on square `at` arrives at: a linked Marker anywhere inside the square (nearest to its centre wins),
 *  else the smallest linked Area containing the square's centre. */
export function partyLocationInSquare(map: Pick<MapRecord, "lines" | "markers">, at: { x: number; y: number }): string | undefined {
  const c = { x: at.x + 0.5, y: at.y + 0.5 };
  let best: { id: string; d: number } | undefined;
  for (const k of map.markers) {
    if (!k.locationId || k.x < at.x || k.x >= at.x + 1 || k.y < at.y || k.y >= at.y + 1) continue;
    const d = Math.hypot(c.x - k.x, c.y - k.y);
    if (!best || d < best.d) best = { id: k.locationId, d };
  }
  if (best) return best.id;
  return areaAt(map.lines.filter((l) => l.area?.locationId), c)?.area?.locationId;
}
