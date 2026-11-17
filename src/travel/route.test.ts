import { neighbours, routeTotals, shortestRoute, type RouteEdge } from "./route";

const e = (fromId: string, toId: string, miles: number, terrain = ""): RouteEdge => ({ fromId, toId, miles, terrain });
const edges = [e("A", "B", 10), e("B", "C", 10), e("A", "C", 50), e("C", "D", 24, "swamp"), e("X", "Y", 5)];

describe("shortestRoute", () => {
  it("prefers fewer miles over fewer hops, in either direction", () => {
    expect(shortestRoute(edges, "A", "C")).toEqual({ path: ["A", "B", "C"], miles: 20 });
    expect(shortestRoute(edges, "C", "A")).toEqual({ path: ["C", "B", "A"], miles: 20 });
  });
  it("returns null when unreachable and a trivial route for same node", () => {
    expect(shortestRoute(edges, "A", "X")).toBeNull();
    expect(shortestRoute(edges, "A", "A")).toEqual({ path: ["A"], miles: 0 });
  });
});

describe("routeTotals and neighbours", () => {
  it("sums miles and per-leg days per pace", () => {
    const t = routeTotals(edges, ["A", "B", "C", "D"]);
    expect(t.miles).toBe(44);
    // normal: 0.42 + 0.42 + 2 (swamp halves speed), summed per leg
    expect(t.days.normal).toBeCloseTo(2.84, 2);
  });
  it("lists connected nodes", () => {
    expect(neighbours(edges, "C").sort()).toEqual(["A", "B", "D"]);
  });
});
