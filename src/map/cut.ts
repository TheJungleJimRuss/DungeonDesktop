import polygonClipping, { type Polygon, type Ring } from "polygon-clipping";
import type { SegmentKind } from "../storage/maps";
import { distanceToSegment, filledArea, polygonArea, type Pt } from "./geometry";

/** What cutting a cutter out of an Area gives (see Subtract shape in GLOSSARY.md):
 *  - `hole`: the cut is inside the outline; `holes` is the Area's new Hole list (overlapping Holes merged). The outline is unchanged.
 *  - `notch`: the cut crosses the outline; the new outline, its segment kinds (see notchSegments) and Holes.
 *  - `touch`: the cut would leave a Hole touching the outline, an outline touching itself, or Holes touching
 *    each other or themselves (the outline must stay one simple ring and Holes separate simple rings strictly inside), so it is refused.
 *  - `split` (would leave several pieces), `erase` (would leave nothing), `miss` (the cutter doesn't overlap the filled part). */
export type CutResult =
  | { kind: "hole"; holes: Pt[][] }
  | { kind: "notch"; outline: Pt[]; segments: SegmentKind[]; holes: Pt[][] }
  | { kind: "touch" } | { kind: "split" } | { kind: "erase" } | { kind: "miss" };

const EPS = 1e-9;
const round = (n: number) => +n.toFixed(6) + 0; // + 0 turns -0 into 0
const toRing = (pts: Pt[]): Ring => pts.map((p) => [p.x, p.y]);
/** A clipped ring as points: rounded, without the closing duplicate (and without repeats rounding made). */
const fromRing = (ring: Ring): Pt[] => {
  const out: Pt[] = [];
  for (const [x, y] of ring) {
    const p = { x: round(x), y: round(y) }, last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  if (out.length > 1 && out[0].x === out[out.length - 1].x && out[0].y === out[out.length - 1].y) out.pop();
  return out;
};
const TOL = 1e-7;
const onSeg = (p: Pt, a: Pt, b: Pt) => distanceToSegment(p, a, b) < TOL;
const onRing = (p: Pt, ring: Pt[]) => ring.some((a, i) => onSeg(p, a, ring[(i + 1) % ring.length]));
const ringsTouch = (a: Pt[], b: Pt[]) => a.some((p) => onRing(p, b)) || b.some((p) => onRing(p, a));
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
/** True when segments ab and cd meet (crossing, touching or overlapping). */
const segmentsMeet = (a: Pt, b: Pt, c: Pt, d: Pt) => {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > TOL && d2 < -TOL) || (d1 < -TOL && d2 > TOL)) && ((d3 > TOL && d4 < -TOL) || (d3 < -TOL && d4 > TOL))) return true;
  return onSeg(a, c, d) || onSeg(b, c, d) || onSeg(c, a, b) || onSeg(d, a, b);
};
/** True when the closed ring never touches or crosses itself (only neighbouring edges share their common point). */
export function isSimpleRing(ring: Pt[]): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // neighbours
      if (segmentsMeet(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** True when the Holes are each one simple ring and no two touch (polygon-clipping can give two Holes meeting at one corner, or one Hole
 *  touching itself there): Holes must stay separate simple rings. */
const holesSimple = (holes: Pt[][]) => holes.every((h, i) => isSimpleRing(h) && holes.slice(i + 1).every((g) => !ringsTouch(h, g)));

/** The segment kinds for a new outline cut from an old one (both closed rings, world squares): an edge lying along an old edge keeps
 *  that edge's kind (wall, door), any other edge is plain. Old points the clipping dropped from a straight run are put back first, so a
 *  run of wall then door still splits where it did. Returns the outline with those points and its kinds (kinds[i] = points i -> i+1). */
export function notchSegments(outline: Pt[], old: Pt[], oldKinds: SegmentKind[]): { outline: Pt[]; segments: SegmentKind[] } {
  const same = (p: Pt, q: Pt) => Math.abs(p.x - q.x) < TOL && Math.abs(p.y - q.y) < TOL;
  const along = (a: Pt, b: Pt) => old.findIndex((p, i) => onSeg(a, p, old[(i + 1) % old.length]) && onSeg(b, p, old[(i + 1) % old.length]));
  const pts: Pt[] = [];
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    pts.push(a); // an old point lying on a new edge adds no turn, so putting it back leaves the shape as it is
    const d = (p: Pt) => Math.hypot(p.x - a.x, p.y - a.y);
    pts.push(...old.filter((p) => onSeg(p, a, b) && !same(p, a) && !same(p, b)).sort((p, q) => d(p) - d(q)));
  });
  return { outline: pts, segments: pts.map((a, i) => oldKinds[along(a, pts[(i + 1) % pts.length])] ?? "plain") };
}

/** Cuts `cutter` out of the Area with this outline (and its segment kinds, absent = all plain) and Holes (all in squares, world
 *  coordinates). Pure; results rounded to 6 decimals. */
export function cutArea(outline: Pt[], holes: Pt[][], cutter: Pt[], kinds: SegmentKind[] = []): CutResult {
  const subject: Polygon = [toRing(outline), ...holes.map(toRing)];
  const result = polygonClipping.difference(subject, [toRing(cutter)]);
  if (result.length === 0) return { kind: "erase" };
  if (result.length > 1) return { kind: "split" };
  const [outer, ...inner] = result[0].map(fromRing);
  const newHoles = inner.filter((h) => h.length >= 3);
  const before = filledArea(outline, holes), after = filledArea(outer, newHoles), scale = Math.max(1, polygonArea(outline));
  if (Math.abs(before - after) <= EPS * scale) return { kind: "miss" };
  // The outer ring keeps the outline's whole area only when the cut stayed inside it (a cut can only shrink the outer ring).
  const sameOutline = Math.abs(polygonArea(outer) - polygonArea(outline)) <= EPS * scale;
  // A Hole must be strictly inside, and the outline one simple ring: a Hole touching the outline (even at one point) or an outline
  // touching itself is refused.
  if (!holesSimple(newHoles)) return { kind: "touch" };
  if (sameOutline) return newHoles.some((h) => ringsTouch(h, outline)) ? { kind: "touch" } : { kind: "hole", holes: newHoles };
  if (!isSimpleRing(outer) || newHoles.some((h) => ringsTouch(h, outer))) return { kind: "touch" };
  return { kind: "notch", ...notchSegments(outer, outline, kinds), holes: newHoles };
}

/** `rings` with each one that is the same set of points as one of `old` replaced by that old ring (its start and direction kept). */
const kept = (rings: Pt[][], old: Pt[][]) => {
  const key = (r: Pt[]) => r.map((p) => `${round(p.x)},${round(p.y)}`).sort().join(" ");
  const byKey = new Map(old.map((r) => [key(r), r]));
  return rings.map((r) => byKey.get(key(r)) ?? r);
};

/** What normalising an Area gives (see normaliseArea): `ok` keeps the outline (`holes` merged where they overlapped or touched), `notch`
 *  rewrites it like a cut across the edge; `split`, `erase` and `touch` are refused as for cutArea. */
export type NormaliseResult =
  | { kind: "ok"; holes: Pt[][] }
  | { kind: "notch"; outline: Pt[]; segments: SegmentKind[]; holes: Pt[][] }
  | { kind: "touch" } | { kind: "split" } | { kind: "erase" };

/** Brings an Area back to the Hole invariant after a point drag (outline or Hole; all in squares, world coordinates): Holes that overlap
 *  or touch merge, and each Hole is subtracted from the outline, so a Hole no longer strictly inside becomes a Notch. An untouched Area
 *  gives `ok` with the very same Holes. A self-crossing outline, or Holes left touching each other or themselves, is refused as `touch`. Pure; new rings rounded to 6 decimals. */
export function normaliseArea(outline: Pt[], holes: Pt[][], kinds: SegmentKind[] = []): NormaliseResult {
  if (!isSimpleRing(outline)) return { kind: "touch" };
  const result = polygonClipping.difference([toRing(outline)], ...holes.map((h): Polygon => [toRing(h)]));
  if (result.length === 0) return { kind: "erase" };
  if (result.length > 1) return { kind: "split" };
  const [outer, ...inner] = result[0].map(fromRing);
  const newHoles = inner.filter((h) => h.length >= 3), scale = Math.max(1, polygonArea(outline));
  if (!holesSimple(newHoles)) return { kind: "touch" };
  if (Math.abs(polygonArea(outer) - polygonArea(outline)) <= EPS * scale) {
    if (newHoles.some((h) => ringsTouch(h, outline))) return { kind: "touch" };
    return { kind: "ok", holes: kept(newHoles, holes) };
  }
  if (!isSimpleRing(outer) || newHoles.some((h) => ringsTouch(h, outer))) return { kind: "touch" };
  return { kind: "notch", ...notchSegments(outer, outline, kinds), holes: kept(newHoles, holes) };
}
