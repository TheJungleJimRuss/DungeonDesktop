import { areaLabelOpacity, routeLabelOpacity, markerOpacity, boundsIntersect, boundsOf, fadeBySize, labelWidthPx, segmentScreenLength, distanceToSegment, hitsPoint, hitsSegment, pointInPolygon, polygonArea, polygonCentroid, labelPoint, pointInArea, ringPath, filledArea, polylineLength, snapToCorner, snapToHalf, snapToStep } from "./geometry";

describe("map geometry", () => {
  it("snaps to the nearest grid corner", () => {
    expect(snapToCorner({ x: 2.4, y: 3.6 })).toEqual({ x: 2, y: 4 });
    expect(snapToCorner({ x: -0.4, y: 0.5 })).toEqual({ x: 0, y: 1 });
  });

  it("snaps to the nearest square centre, corner or edge midpoint", () => {
    expect(snapToHalf({ x: 2.4, y: 3.6 })).toEqual({ x: 2.5, y: 3.5 });
    expect(snapToHalf({ x: 2.1, y: 3.9 })).toEqual({ x: 2, y: 4 });
    expect(snapToHalf({ x: 2.1, y: 3.4 })).toEqual({ x: 2, y: 3.5 });
    expect(snapToHalf({ x: -0.1, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("snaps to a shown grid of any square size, and to its half-steps", () => {
    expect(snapToStep({ x: 1.4, y: 0.2 }, 1 / 3)).toEqual({ x: 1.333333, y: 0.333333 });
    expect(snapToStep({ x: 3.1, y: 4.9 }, 2)).toEqual({ x: 4, y: 4 });
    expect(snapToHalf({ x: 1.1, y: 0.6 }, 2)).toEqual({ x: 1, y: 1 });
  });

  it("measures a polyline, adding the closing segment when closed", () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];
    expect(polylineLength(pts, false)).toBe(7);
    expect(polylineLength(pts, true)).toBe(12);
    expect(polylineLength([{ x: 1, y: 1 }], true)).toBe(0);
    expect(polylineLength([], false)).toBe(0);
  });

  it("tests a point against a concave polygon", () => {
    // An L shape: the notch at the top right is outside.
    const L = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
    expect(pointInPolygon({ x: 1, y: 1 }, L)).toBe(true);
    expect(pointInPolygon({ x: 3, y: 3 }, L)).toBe(true);
    expect(pointInPolygon({ x: 3, y: 1 }, L)).toBe(false);
    expect(pointInPolygon({ x: 5, y: 5 }, L)).toBe(false);
    expect(pointInPolygon({ x: 1, y: 1 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });

  it("computes polygon area regardless of winding", () => {
    const sq = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
    expect(polygonArea(sq)).toBe(12);
    expect(polygonArea([...sq].reverse())).toBe(12);
    expect(polygonArea(sq.slice(0, 2))).toBe(0);
  });

  it("measures the distance from a point to a segment", () => {
    const a = { x: 0, y: 0 }, b = { x: 4, y: 0 };
    expect(distanceToSegment({ x: 2, y: 3 }, a, b)).toBe(3);
    expect(distanceToSegment({ x: -3, y: 4 }, a, b)).toBe(5); // beyond the end: distance to the endpoint
    expect(distanceToSegment({ x: 1, y: 1 }, a, a)).toBeCloseTo(Math.SQRT2);
  });

  it("hit-tests in screen pixels, so the radius follows the zoom", () => {
    const a = { x: 0, y: 0 }, b = { x: 4, y: 0 };
    const p = { x: 2, y: 0.2 }; // 0.2 squares off the line
    expect(hitsSegment(p, a, b, 40, 10)).toBe(true); // 8 px away at 40 px/square
    expect(hitsSegment(p, a, b, 80, 10)).toBe(false); // 16 px away when zoomed in
    expect(hitsPoint({ x: 0.1, y: 0 }, a, 40, 10)).toBe(true);
    expect(hitsPoint({ x: 0.5, y: 0 }, a, 40, 10)).toBe(false);
  });

  it("finds a polygon's centroid, falling back to the mean of the points", () => {
    expect(polygonCentroid([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }])).toEqual({ x: 2, y: 1 });
    expect(polygonCentroid([{ x: 0, y: 0 }, { x: 2, y: 2 }])).toEqual({ x: 1, y: 1 });
  });

  it("puts a label inside the shape, even when the centroid falls outside it", () => {
    const rect = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }];
    expect(labelPoint(rect)).toEqual({ x: 2, y: 1 }); // centroid kept when it sits well inside
    // A C shape (a loop that isn't closed in the middle): its centroid is in the empty gap.
    const c = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 8 }, { x: 10, y: 8 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(pointInPolygon(polygonCentroid(c), c)).toBe(false);
    const p = labelPoint(c);
    expect(pointInPolygon(p, c)).toBe(true);
    expect(p.x).toBeLessThan(2); // in the thick left bar
    expect(labelPoint([{ x: 0, y: 0 }, { x: 2, y: 2 }])).toEqual({ x: 1, y: 1 });
  });
});

describe("Areas with Holes", () => {
  const sq = (x: number, y: number, s: number) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
  it("a point is in the Area when inside the outline and in no Hole", () => {
    const holes = [sq(2, 2, 2), sq(6, 6, 2)];
    expect(pointInArea({ x: 1, y: 1 }, sq(0, 0, 10), holes)).toBe(true);
    expect(pointInArea({ x: 3, y: 3 }, sq(0, 0, 10), holes)).toBe(false);
    expect(pointInArea({ x: 7, y: 7 }, sq(0, 0, 10), holes)).toBe(false);
    expect(pointInArea({ x: 11, y: 1 }, sq(0, 0, 10), holes)).toBe(false);
    expect(pointInArea({ x: 3, y: 3 }, sq(0, 0, 10))).toBe(true);
  });

  it("an Area's size is its outline minus its Holes", () => {
    expect(filledArea(sq(0, 0, 10), [sq(2, 2, 2), sq(6, 6, 3)])).toBe(100 - 4 - 9);
    expect(filledArea(sq(0, 0, 10))).toBe(100);
    expect(filledArea(sq(0, 0, 10), [])).toBe(100);
  });

  it("draws a ring as one closed SVG subpath, scaled", () => {
    expect(ringPath(sq(1, 2, 3), 10)).toBe("M10 20 L40 20 L40 50 L10 50 Z");
  });

  it("puts the label on the filled part, not in a Hole", () => {
    const outline = sq(0, 0, 10), hole = sq(2, 2, 6);
    const p = labelPoint(outline, [hole]);
    expect(pointInArea(p, outline, [hole])).toBe(true);
    expect(labelPoint(outline)).toEqual({ x: 5, y: 5 }); // the same outline without Holes keeps its centroid (the cache tells them apart)
    expect(labelPoint(outline, [hole])).toEqual(p);
  });
});

describe("fading by size", () => {
  it("is 0 at and below the minimum, 1 at the end of the band, and ramps in between", () => {
    expect(fadeBySize(0, 4)).toBe(0);
    expect(fadeBySize(4, 4)).toBe(0);
    expect(fadeBySize(6, 4)).toBeCloseTo(0.5);
    expect(fadeBySize(8, 4)).toBe(1);
    expect(fadeBySize(500, 4)).toBe(1);
  });
  it("only ever rises with size (no pop)", () => {
    let last = 0;
    for (let px = 0; px <= 12; px += 0.25) { const f = fadeBySize(px, 4); expect(f).toBeGreaterThanOrEqual(last); last = f; }
  });
  it("takes a custom band, and a zero band is a hard step", () => {
    expect(fadeBySize(11, 10, 4)).toBeCloseTo(0.25);
    expect(fadeBySize(14, 10, 4)).toBe(1);
    expect(fadeBySize(10.1, 10, 0)).toBe(1);
    expect(fadeBySize(10, 10, 0)).toBe(0);
  });
  it("measures a segment on screen", () => {
    expect(segmentScreenLength({ x: 0, y: 0 }, { x: 3, y: 4 }, 2)).toBe(10);
  });
  it("estimates a label's width from its length", () => {
    expect(labelWidthPx("")).toBe(0);
    expect(labelWidthPx("abcd")).toBeGreaterThan(labelWidthPx("ab"));
  });
});

describe("culling bounds", () => {
  const view = { x0: 0, y0: 0, x1: 10, y1: 10 };
  it("bounds a set of points", () => {
    expect(boundsOf([{ x: 3, y: -1 }, { x: -2, y: 5 }])).toEqual({ x0: -2, y0: -1, x1: 3, y1: 5 });
  });
  it("intersects when overlapping or touching, not when apart", () => {
    expect(boundsIntersect({ x0: 5, y0: 5, x1: 20, y1: 20 }, view)).toBe(true);
    expect(boundsIntersect({ x0: 10, y0: 0, x1: 12, y1: 2 }, view)).toBe(true);
    expect(boundsIntersect({ x0: 11, y0: 0, x1: 12, y1: 2 }, view)).toBe(false);
    expect(boundsIntersect({ x0: -9, y0: -9, x1: -1, y1: -1 }, view)).toBe(false);
  });
  it("a margin widens the view", () => {
    expect(boundsIntersect({ x0: 11, y0: 0, x1: 12, y1: 2 }, view, 2)).toBe(true);
    expect(boundsIntersect({ x0: 13, y0: 0, x1: 14, y1: 2 }, view, 2)).toBe(false);
  });
});

describe("markerOpacity", () => {
  const FACTOR = { minor: 3, normal: 10, major: 100 } as const;
  for (const [p, f] of Object.entries(FACTOR)) {
    it(`${p}: full up to ${f}x, half-ish in the ramp, gone at ${f * 1.5}x`, () => {
      const pr = p as keyof typeof FACTOR;
      expect(markerOpacity(32, 32, pr)).toBe(1);
      expect(markerOpacity(32 * f * 0.9, 32, pr)).toBe(1);
      expect(markerOpacity(32 * f, 32, pr)).toBe(1);
      const mid = markerOpacity(32 * f * Math.sqrt(1.5), 32, pr);
      expect(mid).toBeGreaterThan(0.45);
      expect(mid).toBeLessThan(0.55);
      expect(markerOpacity(32 * f * 1.5, 32, pr)).toBe(0);
      expect(markerOpacity(32 * f * 5, 32, pr)).toBe(0);
    });
  }
  it("zooming in past the placing zoom is always 1", () => {
    for (const p of ["minor", "normal", "major", "always"] as const) expect(markerOpacity(32, 320, p)).toBe(1);
  });
  it("always never fades", () => expect(markerOpacity(1e9, 0.01, "always")).toBe(1));
});

describe("routeLabelOpacity", () => {
  it("hides the distance label once the Route is smaller on screen than the text", () => {
    expect(routeLabelOpacity(1, 200, "120 ft")).toBe(1);
    expect(routeLabelOpacity(1, 30, "120 ft")).toBe(0);
  });
  it("never shows more than the Route itself", () => expect(routeLabelOpacity(0.3, 200, "120 ft")).toBe(0.3));
});

describe("areaLabelOpacity", () => {
  it("Normal hides the label when the Area is narrower than its text", () => {
    expect(areaLabelOpacity(1, 200, "Town")).toBe(1);
    expect(areaLabelOpacity(1, 20, "Town")).toBe(0);
  });
  it("Major follows the Area's own fade, whatever the text width", () => {
    expect(areaLabelOpacity(1, 20, "A very long town name", "major")).toBe(1);
    expect(areaLabelOpacity(0.5, 20, "Town", "major")).toBe(0.5);
    expect(areaLabelOpacity(0, 2, "Town", "major")).toBe(0);
  });
  it("Always keeps the label even after the Area has faded", () => {
    expect(areaLabelOpacity(0, 0.01, "Capital", "always")).toBe(1);
  });
});
