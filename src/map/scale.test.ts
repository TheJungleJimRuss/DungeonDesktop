import { describe, expect, it } from "vitest";
import { scaleBar } from "./scale";

describe("scaleBar", () => {
  it("picks the longest round distance that fits", () => {
    expect(scaleBar(8)).toEqual({ amount: 10, px: 80 }); // 120 px = 15 ft → 10 ft
    expect(scaleBar(1)).toEqual({ amount: 100, px: 100 });
    expect(scaleBar(0.5)).toEqual({ amount: 200, px: 100 });
    expect(scaleBar(0.2)).toEqual({ amount: 500, px: 100 });
  });
  it("handles fractions when zoomed far in", () => {
    expect(scaleBar(400)).toEqual({ amount: 0.2, px: 80 });
  });
  it("is absent without a usable scale", () => {
    expect(scaleBar(0)).toBeNull();
    expect(scaleBar(Infinity)).toBeNull();
  });
});

import { BATTLE_PX_PER_SQUARE, MAX_PX_PER_SQUARE, FEET_PER_SQUARE, MIN_PX_PER_SQUARE, battleView, clampPxPerSquare, fitView, formatSquares, gridLadder, mapBounds } from "./scale";

describe("formatSquares (5 ft per square)", () => {
  it("reads ft below 1,000 ft and mi from there", () => {
    expect(formatSquares(5)).toBe("25 ft");
    expect(formatSquares(1.5)).toBe("7.5 ft");
    expect(formatSquares(199)).toBe("995 ft");
    expect(formatSquares(200)).toBe("0.19 mi");
    expect(formatSquares(1056)).toBe("1 mi");
    expect(formatSquares(0)).toBe("0 ft");
  });
});
describe("zoom limits and battle scale", () => {
  it("clamps from 1e-7 to 1000 px per square, and falls back to battle scale for junk", () => {
    expect(clampPxPerSquare(1e-12)).toBe(MIN_PX_PER_SQUARE);
    expect(clampPxPerSquare(5000)).toBe(MAX_PX_PER_SQUARE);
    expect(clampPxPerSquare(12)).toBe(12);
    expect(clampPxPerSquare(NaN)).toBe(BATTLE_PX_PER_SQUARE);
    expect(clampPxPerSquare(-3)).toBe(BATTLE_PX_PER_SQUARE);
  });
  it("shows a 5 ft grid at battle scale and relabels as it zooms out", () => {
    expect(battleView()).toEqual({ centre: { x: 0, y: 0 }, pxPerSquare: BATTLE_PX_PER_SQUARE });
    expect(gridLadder(BATTLE_PX_PER_SQUARE).dominant).toBe(5);
    expect(gridLadder(BATTLE_PX_PER_SQUARE / 10).dominant).toBe(50);
    expect(gridLadder(BATTLE_PX_PER_SQUARE / 1056).dominant).toBeCloseTo(5280, 6); // 1 mi
  });
});
describe("gridLadder (1, 2, 5 steps: ft up to 500 ft, then mi)", () => {
  const at = (ft: number) => gridLadder((FEET_PER_SQUARE * BATTLE_PX_PER_SQUARE) / ft); // the zoom where the ideal grid is `ft` feet
  it("sits on a step with weight 1 exactly at that step", () => {
    for (const ft of [5, 10, 20, 50, 100, 200, 500, 5280, 10560, 26400, 52800]) {
      const g = at(ft);
      expect(g.dominant).toBeCloseTo(ft, 6);
      expect(g.wLo + g.wHi).toBeCloseTo(1, 9);
      expect(Math.max(g.wLo, g.wHi)).toBeCloseTo(1, 9);
    }
  });
  it("crossfades neighbouring steps by log position, weights summing to 1", () => {
    const g = at(Math.sqrt(10 * 20)); // halfway between 10 and 20 ft in log terms
    expect([g.lo, g.hi]).toEqual([10, 20]);
    expect(g.wLo).toBeCloseTo(0.5, 6);
    expect(at(12).dominant).toBe(10);
    expect(at(17).dominant).toBe(20);
    expect(at(12).wHi).toBeLessThan(0.5);
  });
  it("crosses from 500 ft straight to 1 mi (5,280 ft)", () => {
    const g = at(1500);
    expect([g.lo, g.hi]).toEqual([500, 5280]);
    expect(g.wLo + g.wHi).toBeCloseTo(1, 9);
    expect(at(4000).dominant).toBe(5280);
    expect(at(30000).dominant).toBe(26400); // 5 mi
  });
  it("never goes finer than the 5 ft base square", () => {
    const g = gridLadder(MAX_PX_PER_SQUARE);
    expect(g.dominant).toBe(5);
    expect(g.lo).toBe(5);
    expect(g.wLo).toBe(1);
    expect(g.wHi).toBe(0);
    expect(gridLadder(BATTLE_PX_PER_SQUARE * 2).dominant).toBe(5);
  });
  it("keeps a target size: another target shifts the ladder", () => {
    expect(gridLadder(BATTLE_PX_PER_SQUARE, 64).dominant).toBe(10);
    expect(gridLadder(BATTLE_PX_PER_SQUARE / 10, 64).dominant).toBe(100);
  });
  it("copes with the deepest zoom out", () => {
    const g = gridLadder(MIN_PX_PER_SQUARE);
    expect(Number.isFinite(g.dominant)).toBe(true);
    expect(g.wLo + g.wHi).toBeCloseTo(1, 9);
  });
});
describe("mapBounds and fitView", () => {
  const empty = { lines: [], markers: [], tokens: [] };
  it("is null for an empty Map, which fits to battle scale at the start point", () => {
    expect(mapBounds(empty)).toBeNull();
    expect(fitView(null, { w: 800, h: 500 })).toEqual(battleView());
  });
  it("covers Line points, Markers, Tokens (a whole square) and the Party Token", () => {
    const b = mapBounds({ lines: [{ points: [{ x: -10, y: 2 }, { x: 4, y: 3 }] }], markers: [{ x: 0, y: 40 }], tokens: [{ x: 100, y: 0 }], partyToken: { x: -20, y: -5 } });
    expect(b).toEqual({ minX: -20, minY: -5, maxX: 101, maxY: 40 });
  });
  it("pads the bounds, centres on them and zooms out to fit", () => {
    const v = fitView({ minX: 0, minY: 0, maxX: 1000, maxY: 100 }, { w: 1200, h: 600 });
    expect(v.centre).toEqual({ x: 500, y: 50 });
    expect(v.pxPerSquare).toBeCloseTo(1200 / 1200, 6); // 1000 squares + 10% each side = 1200 squares across 1200 px
  });
  it("never zooms in past battle scale, even for one Marker", () => {
    expect(fitView({ minX: 3, minY: 3, maxX: 3, maxY: 3 }, { w: 800, h: 500 })).toEqual({ centre: { x: 3, y: 3 }, pxPerSquare: BATTLE_PX_PER_SQUARE });
  });
  it("stays within the zoom limits for an enormous world", () => {
    expect(fitView({ minX: 0, minY: 0, maxX: 1e12, maxY: 1 }, { w: 800, h: 500 }).pxPerSquare).toBe(MIN_PX_PER_SQUARE);
  });
});
