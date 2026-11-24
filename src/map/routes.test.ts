import { pointAlong, routeLength } from "./routes";

describe("routes", () => {
  const pts = [{ x: 2, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 5 }]; // 3 + 4 squares

  it("routeLength is the whole polyline times the scale, in the unit, never closing back", () => {
    expect(routeLength(pts, 5, "ft")).toBe("35 ft");
    expect(routeLength(pts, 6, "mi")).toBe("42 mi");
    expect(routeLength(pts, 0.5, "mi")).toBe("3.5 mi");
    expect(routeLength([{ x: 0, y: 0 }, { x: 1, y: 1 }], 1, "ft")).toBe("1.41 ft"); // two decimals at most
    expect(routeLength([pts[0]], 5, "ft")).toBe("0 ft");
  });

  it("pointAlong finds the point at a fraction of the path length", () => {
    expect(pointAlong(pts, 0.5)).toEqual({ x: 5, y: 1.5 }); // 3.5 of 7 squares: the first leg, then 0.5 down the second
    expect(pointAlong(pts, 0)).toEqual(pts[0]);
    expect(pointAlong(pts, 1)).toEqual(pts[2]);
    expect(pointAlong([pts[0]], 0.5)).toEqual(pts[0]);
  });
});
