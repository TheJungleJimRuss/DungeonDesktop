import { pointAlong, routeLength } from "./routes";

describe("routes", () => {
  const pts = [{ x: 2, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 5 }]; // 3 + 4 squares

  it("routeLength is the whole polyline from 5 ft per square, never closing back", () => {
    expect(routeLength(pts)).toBe("35 ft");
    expect(routeLength([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe("7.07 ft"); // two decimals at most
    expect(routeLength([pts[0]])).toBe("0 ft");
  });
  it("routeLength reads in miles from 1,000 ft", () => {
    expect(routeLength([{ x: 0, y: 0 }, { x: 199, y: 0 }])).toBe("995 ft");
    expect(routeLength([{ x: 0, y: 0 }, { x: 1056 * 6, y: 0 }])).toBe("6 mi");
  });

  it("pointAlong finds the point at a fraction of the path length", () => {
    expect(pointAlong(pts, 0.5)).toEqual({ x: 5, y: 1.5 }); // 3.5 of 7 squares: the first leg, then 0.5 down the second
    expect(pointAlong(pts, 0)).toEqual(pts[0]);
    expect(pointAlong(pts, 1)).toEqual(pts[2]);
    expect(pointAlong([pts[0]], 0.5)).toEqual(pts[0]);
  });
});
