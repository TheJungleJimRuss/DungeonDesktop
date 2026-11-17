import { describe, expect, it } from "vitest";
import { settleAround } from "./dashboardLayout";

const at = (panelId: string, x: number, y: number, w = 60, h = 30) => ({ panelId, x, y, w, h });
const pos = (layout: { panelId: string; x: number; y: number }[]) =>
  Object.fromEntries(layout.map((e) => [e.panelId, [e.x, e.y]]));

describe("settleAround (layout during a drag or resize)", () => {
  const start = [at("a", 0, 0), at("b", 0, 40), at("c", 0, 80)];

  it("pushes a panel down while the moved panel covers it", () => {
    expect(pos(settleAround(start, at("a", 0, 30)))).toEqual({ a: [0, 30], b: [0, 60], c: [0, 90] });
  });

  it("moves pushed panels back to where they started once nothing covers them", () => {
    // a dragged over b, then on to empty space on the right: b and c are back home.
    expect(pos(settleAround(start, at("a", 60, 200)))).toEqual({ a: [60, 200], b: [0, 40], c: [0, 80] });
  });

  it("keeps gaps and never moves anything up", () => {
    const gappy = [at("a", 0, 0), at("b", 60, 100)];
    expect(pos(settleAround(gappy, at("a", 0, 10)))).toEqual({ a: [0, 10], b: [60, 100] });
  });

  it("works for a resize: the grown panel pushes, the shrunk panel lets others back", () => {
    expect(pos(settleAround(start, at("a", 0, 0, 60, 50)))).toEqual({ a: [0, 0], b: [0, 50], c: [0, 80] });
    expect(pos(settleAround(start, at("a", 0, 0, 60, 30)))).toEqual({ a: [0, 0], b: [0, 40], c: [0, 80] });
  });
});
