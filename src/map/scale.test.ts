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
