import { seqRng } from "../dice/dice";
import { STYLES, generateName, generateNames, type Rng } from "./names";

/** Small seeded PRNG (mulberry32) for deterministic tests. */
const seeded = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("name generator", () => {
  it("is deterministic for the same seed", () => {
    for (const s of STYLES) expect(generateNames(seeded(7), s.id, 5)).toEqual(generateNames(seeded(7), s.id, 5));
  });
  it("varies between seeds and within a batch", () => {
    for (const s of STYLES) {
      const a = generateNames(seeded(1), s.id, 6);
      expect(new Set(a).size).toBe(6);
      expect(generateNames(seeded(2), s.id, 6)).not.toEqual(a);
    }
  });
  it("makes non-empty, capitalised names, even at the rng extremes", () => {
    for (const s of STYLES) {
      for (const n of [...generateNames(seeded(3), s.id, 30), generateName(seqRng([0]), s.id), generateName(seqRng([0.999999]), s.id)]) {
        expect(n.trim()).not.toBe("");
        expect(n[0]).toBe(n[0].toUpperCase());
      }
    }
  });
  it("any style mixes styles and returns the requested count", () => {
    expect(generateNames(seeded(9), "any", 8)).toHaveLength(8);
  });
});
