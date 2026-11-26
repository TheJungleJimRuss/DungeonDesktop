import type { Pt } from "./geometry";
import { BATTLE_PX_PER_SQUARE, fitView, type Bounds } from "./scale";

export type FindKind = "marker" | "area" | "line" | "token" | "party";
export interface FindTarget { kind: FindKind; id: string; label: string; at: Pt;
  /** A Marker's placing zoom (pixels per square). */ placedAt?: number;
  /** An Area's or Line's box, in squares. */ bounds?: Bounds; }

export const lineBounds = (points: Pt[]): Bounds => ({ minX: Math.min(...points.map((p) => p.x)), maxX: Math.max(...points.map((p) => p.x)), minY: Math.min(...points.map((p) => p.y)), maxY: Math.max(...points.map((p) => p.y)) });

/** Where the view goes for a target: a Marker at its placing zoom (battle scale when it has none, as its fading assumes), an Area or Line fitted to its bounds
 *  (padded, never closer than battle scale), a Token or the Party Token at battle scale. */
export function findView(t: FindTarget, size: { w: number; h: number }, currentPx: number): { centre: Pt; pxPerSquare: number } {
  if (t.kind === "marker") return { centre: t.at, pxPerSquare: t.placedAt ?? BATTLE_PX_PER_SQUARE };
  if ((t.kind === "area" || t.kind === "line") && t.bounds) return fitView(t.bounds, size);
  return { centre: t.at, pxPerSquare: t.kind === "token" || t.kind === "party" ? BATTLE_PX_PER_SQUARE : currentPx };
}

/** The middle of a Line's bounding box, in squares. */
export function lineCentre(points: Pt[]): Pt {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/** Targets whose label contains `query` (case-insensitive), best first: a label that starts with the query, then the rest, each in order. Empty query: none. */
export function findTargets(all: FindTarget[], query: string): FindTarget[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits = all.filter((t) => t.label.toLowerCase().includes(q));
  const starts = (t: FindTarget) => (t.label.toLowerCase().startsWith(q) ? 0 : 1);
  return hits.map((t, i) => ({ t, i })).sort((a, b) => starts(a.t) - starts(b.t) || a.i - b.i).map((x) => x.t);
}
