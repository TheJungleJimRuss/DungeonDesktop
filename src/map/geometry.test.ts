import { distanceToSegment, hitsPoint, hitsSegment, pointInPolygon, polygonArea, polygonCentroid, polylineLength, snapToCorner } from "./geometry";

describe("map geometry", () => {
  it("snaps to the nearest grid corner", () => {
    expect(snapToCorner({ x: 2.4, y: 3.6 })).toEqual({ x: 2, y: 4 });
    expect(snapToCorner({ x: -0.4, y: 0.5 })).toEqual({ x: 0, y: 1 });
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
});
