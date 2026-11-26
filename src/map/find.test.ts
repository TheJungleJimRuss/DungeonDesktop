import { describe, expect, it } from "vitest";
import { findTargets, findView, lineCentre, type FindTarget } from "./find";
import { BATTLE_PX_PER_SQUARE } from "./scale";

const t = (label: string, kind: FindTarget["kind"] = "marker"): FindTarget => ({ kind, id: label, label, at: { x: 0, y: 0 } });

describe("findTargets", () => {
  it("matches any part of a label, ignoring case", () => {
    expect(findTargets([t("Blackwater Keep"), t("Inn")], "KEEP").map((x) => x.label)).toEqual(["Blackwater Keep"]);
  });
  it("puts labels that start with the query first, then keeps order", () => {
    expect(findTargets([t("Old Tower"), t("Tower Gate"), t("New Tower")], "tower").map((x) => x.label)).toEqual(["Tower Gate", "Old Tower", "New Tower"]);
  });
  it("finds nothing for an empty or blank query", () => {
    expect(findTargets([t("A")], "  ")).toEqual([]);
  });
});

describe("lineCentre", () => {
  it("is the middle of the bounding box", () => {
    expect(lineCentre([{ x: 0, y: 0 }, { x: 10, y: 2 }, { x: 4, y: 8 }])).toEqual({ x: 5, y: 4 });
  });
});

describe("findView", () => {
  it("goes to a Marker with no placing zoom at battle scale, the zoom its fading assumes, not the current zoom", () => {
    expect(findView(t("Old"), { w: 800, h: 500 }, 0.001).pxPerSquare).toBe(BATTLE_PX_PER_SQUARE);
    expect(findView({ ...t("New"), placedAt: 2 }, { w: 800, h: 500 }, 0.001).pxPerSquare).toBe(2);
  });
});
