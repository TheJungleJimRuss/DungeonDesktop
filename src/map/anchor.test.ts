import { anchorFor, toLocal, toWorld } from "./anchor";
import { snapToStep } from "./geometry";
import { CELL } from "./lines";

describe("view anchor", () => {
  it("is a whole number of squares, a multiple of a power of two that grows with the view", () => {
    expect(anchorFor({ x: 0, y: 0 }, 32, 800)).toEqual({ x: 0, y: 0 });
    const a = anchorFor({ x: 1_000_000.3, y: -999_999.7 }, 32, 800); // view 25 squares wide -> step 32
    expect(Math.abs(a.x % 32)).toBe(0); expect(Math.abs(a.y % 32)).toBe(0);
    expect(Math.abs(a.x - 1_000_000.3)).toBeLessThanOrEqual(16);
    expect(anchorFor({ x: 1_000_000, y: 0 }, 1000, 1400).x % 2).toBe(0); // zoomed far in: a small step
    expect(anchorFor({ x: 1e6, y: 0 }, 1e-3, 800).x % 2 ** 20).toBe(0); // zoomed far out: a big step, still whole squares
  });

  it("keeps drawn coordinates small however far out the view is", () => {
    for (const px of [1000, 32, 1]) {
      const centre = { x: 1_000_000.37, y: -1_000_000.81 }, a = anchorFor(centre, px, 1400);
      const local = toLocal(centre, a);
      expect(Math.abs(local.x) * CELL).toBeLessThan(((1400 / px) * CELL) + 1); // within about one view width of 0
    }
  });

  it("round-trips exactly, 1,000,000 squares out at battle scale and at 1000 px per square", () => {
    for (const px of [32, 1000]) {
      const centre = { x: 1_000_000, y: 1_000_000 }, a = anchorFor(centre, px, 1400);
      for (const p of [{ x: 1_000_000.2, y: 999_999.6 }, { x: 1_000_003.123456, y: 1_000_000.000001 }, snapToStep({ x: 1_000_000.37, y: 999_999.91 }, 0.5)]) {
        const back = toWorld(toLocal(p, a), a);
        expect(Math.abs(back.x - p.x)).toBeLessThan(1e-6);
        expect(Math.abs(back.y - p.y)).toBeLessThan(1e-6);
      }
    }
  });

  it("snapping in world space then localising lands exactly on a grid square after the round trip", () => {
    const a = anchorFor({ x: 1_000_000, y: 0 }, 32, 800);
    const s = snapToStep({ x: 1_000_000.37, y: 3.2 }, 1);
    expect(toWorld(toLocal(s, a), a)).toEqual({ x: 1_000_000, y: 3 });
  });
});
