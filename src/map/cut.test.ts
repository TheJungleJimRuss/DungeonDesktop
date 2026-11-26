import { cutArea, isSimpleRing, normaliseArea, notchSegments } from "./cut";
import type { Pt } from "./geometry";

const sq = (x: number, y: number, s: number): Pt[] => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const rect = (x: number, y: number, w: number, h: number): Pt[] => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
/** A ring as a sorted set of "x,y" keys, so tests ignore where it starts and which way it runs. */
const keys = (ring: Pt[]) => ring.map((p) => `${p.x},${p.y}`).sort();

describe("cutArea", () => {
  const outline = sq(0, 0, 10);

  it("a cutter strictly inside makes a Hole and keeps the outline array as it was", () => {
    const r = cutArea(outline, [], sq(2, 2, 2));
    expect(r.kind).toBe("hole");
    if (r.kind !== "hole") return;
    expect(r.holes).toHaveLength(1);
    expect(keys(r.holes[0])).toEqual(keys(sq(2, 2, 2)));
    expect(r.holes[0]).toHaveLength(4); // the closing duplicate is dropped
  });

  it("a cutter sharing an edge with the outline makes a Notch", () => {
    const r = cutArea(outline, [], sq(0, 2, 2));
    expect(r.kind).toBe("notch");
    if (r.kind !== "notch") return;
    expect(keys(r.outline)).toEqual(keys([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 4 }, { x: 2, y: 4 }, { x: 2, y: 2 }, { x: 0, y: 2 }]));
    expect(r.holes).toEqual([]);
  });

  it("a cutter crossing the edge makes a Notch", () => {
    const r = cutArea(outline, [], sq(8, 4, 4));
    expect(r.kind).toBe("notch");
  });

  it("a cutter touching the outline from outside, at a corner or along an edge, misses", () => {
    expect(cutArea(outline, [], sq(10, 10, 2)).kind).toBe("miss");
    expect(cutArea(outline, [], sq(10, 2, 2)).kind).toBe("miss");
  });

  it("a cutter inside sharing two edges at a corner is a Notch", () => {
    expect(cutArea(outline, [], sq(0, 0, 2)).kind).toBe("notch");
  });

  it("a cutter inside touching the outline at one point is refused as a touch (Holes are strictly inside)", () => {
    expect(cutArea(outline, [], [{ x: 0, y: 5 }, { x: 2, y: 4 }, { x: 2, y: 6 }]).kind).toBe("touch");
  });

  it("a cut that would leave the outline touching itself is refused", () => {
    const r = cutArea(outline, [], [{ x: -1, y: 4 }, { x: 10, y: 5 }, { x: -1, y: 6 }]).kind;
    expect(["touch", "split"]).toContain(r); // never a Notch with a pinched outline
    // A Notch whose cut leaves an existing Hole touching the new outline at one point is refused too.
    expect(cutArea(outline, [[{ x: 5, y: 4 }, { x: 7, y: 3 }, { x: 7, y: 5 }]], rect(-1, 3, 6, 2)).kind).toBe("touch");
  });

  it("a cutter overlapping an existing Hole merges with it", () => {
    const r = cutArea(outline, [sq(2, 2, 2)], sq(3, 3, 2));
    expect(r.kind).toBe("hole");
    if (r.kind !== "hole") return;
    expect(r.holes).toHaveLength(1);
    expect(keys(r.holes[0])).toEqual(keys([{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 4 }, { x: 2, y: 4 }]));
  });

  it("a separate cutter adds a second Hole beside the first", () => {
    const r = cutArea(outline, [sq(2, 2, 2)], sq(6, 6, 2));
    expect(r.kind === "hole" && r.holes.length).toBe(2);
  });

  it("a cutter only inside an existing Hole misses", () => {
    expect(cutArea(outline, [sq(2, 2, 4)], sq(3, 3, 1)).kind).toBe("miss");
  });

  it("a cutter covering the whole Area erases it", () => {
    expect(cutArea(outline, [], sq(-1, -1, 12)).kind).toBe("erase");
    expect(cutArea(outline, [sq(2, 2, 2)], outline).kind).toBe("erase");
  });

  it("a bar across the Area splits it", () => {
    expect(cutArea(outline, [], rect(-1, 4, 12, 2)).kind).toBe("split");
  });

  it("a cutter outside misses", () => {
    expect(cutArea(outline, [], sq(20, 20, 2)).kind).toBe("miss");
  });

  it("a cutter over a Hole and the edge makes one Notch, the Hole joining it", () => {
    const r = cutArea(outline, [sq(2, 2, 2)], rect(-1, 2.5, 4, 1));
    expect(r.kind).toBe("notch");
    if (r.kind !== "notch") return;
    expect(r.holes).toEqual([]);
    expect(r.outline.length).toBeGreaterThan(4);
  });

  it("rounds to 6 decimals, with no -0", () => {
    const r = cutArea(outline, [], [{ x: 1 / 3, y: 1 / 3 }, { x: 2 / 3, y: 1 / 3 }, { x: 2 / 3, y: 2 / 3 }]);
    expect(r.kind === "hole" && keys(r.holes[0])).toEqual(["0.333333,0.333333", "0.666667,0.333333", "0.666667,0.666667"]);
    const n = cutArea(sq(-2, -2, 4), [], sq(-3, -1, 2));
    expect(n.kind === "notch" && n.outline.every((p) => !Object.is(p.x, -0) && !Object.is(p.y, -0))).toBe(true);
  });
});

describe("notch segment kinds", () => {
  const outline = sq(0, 0, 10); // edges: top, right, bottom, left

  it("keeps a wall on the surviving parts of a walled edge and a door on an untouched edge; new notch edges are plain", () => {
    const r = cutArea(outline, [], sq(4, -1, 2), ["wall", "door", "plain", "wall"]);
    expect(r.kind).toBe("notch");
    if (r.kind !== "notch") return;
    const kindOf = (ax: number, ay: number, bx: number, by: number) => {
      const i = r.outline.findIndex((p, j) => {
        const q = r.outline[(j + 1) % r.outline.length];
        return (p.x === ax && p.y === ay && q.x === bx && q.y === by) || (p.x === bx && p.y === by && q.x === ax && q.y === ay);
      });
      expect(i).toBeGreaterThanOrEqual(0);
      return r.segments[i];
    };
    expect(r.segments).toHaveLength(r.outline.length);
    expect(kindOf(0, 0, 4, 0)).toBe("wall");
    expect(kindOf(6, 0, 10, 0)).toBe("wall");
    expect(kindOf(4, 0, 4, 1)).toBe("plain");
    expect(kindOf(4, 1, 6, 1)).toBe("plain");
    expect(kindOf(6, 1, 6, 0)).toBe("plain");
    expect(kindOf(10, 0, 10, 10)).toBe("door");
    expect(kindOf(0, 10, 0, 0)).toBe("wall");
  });

  it("puts back an old point the clipping dropped from a straight run, so wall then door still splits there", () => {
    const old = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const cut = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 10 }, { x: 0, y: 10 }]; // (5,0) dropped
    const r = notchSegments(cut, old, ["wall", "door", "plain", "plain", "plain"]);
    expect(r.outline[1]).toEqual({ x: 5, y: 0 });
    expect(r.segments).toEqual(["wall", "door", "plain", "plain", "plain", "plain", "plain"]);
  });

  it("an outline without kinds gives all plain", () => {
    const r = cutArea(outline, [], sq(8, 4, 4));
    expect(r.kind === "notch" && r.segments.every((k) => k === "plain")).toBe(true);
  });
});

describe("isSimpleRing", () => {
  it("accepts a plain ring and refuses one touching itself", () => {
    expect(isSimpleRing(sq(0, 0, 2))).toBe(true);
    expect(isSimpleRing([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 4 }, { x: 0, y: 4 }, { x: 2, y: 2 }])).toBe(false);
  });
});

describe("normaliseArea (after a point drag)", () => {
  const outline = sq(0, 0, 10);

  it("leaves an untouched Area as it is: ok with the same Holes", () => {
    const holes = [sq(2, 2, 2), sq(6, 6, 2)];
    expect(normaliseArea(outline, holes)).toEqual({ kind: "ok", holes });
    expect(normaliseArea(outline, [])).toEqual({ kind: "ok", holes: [] });
  });

  it("merges Holes that came to overlap or touch", () => {
    const r = normaliseArea(outline, [sq(2, 2, 2), sq(3, 3, 2)]);
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.holes).toHaveLength(1);
    expect(keys(r.holes[0])).toEqual(keys([{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 4 }, { x: 2, y: 4 }]));
    const t = normaliseArea(outline, [sq(2, 2, 2), sq(4, 2, 2)]); // sharing an edge
    expect(t.kind === "ok" && t.holes.length).toBe(1);
  });

  it("refuses Holes that would merge into one ring touching itself (two Holes meeting at one corner), by drag or by cut", () => {
    expect(normaliseArea(outline, [sq(2, 2, 2), sq(4, 4, 2)])).toEqual({ kind: "touch" });
    expect(cutArea(outline, [sq(2, 2, 2)], sq(4, 4, 2))).toEqual({ kind: "touch" });
  });

  it("a Hole that escaped across the outline becomes a Notch, keeping the outline's segment kinds where it survives", () => {
    const r = normaliseArea(outline, [rect(8, 4, 4, 2), sq(2, 2, 2)], ["wall", "door", "wall", "wall"]);
    expect(r.kind).toBe("notch");
    if (r.kind !== "notch") return;
    expect(keys(r.outline)).toEqual(keys([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 8, y: 4 }, { x: 8, y: 6 }, { x: 10, y: 6 }, { x: 10, y: 10 }, { x: 0, y: 10 }]));
    expect(r.segments).toHaveLength(r.outline.length);
    expect(r.segments.filter((k) => k === "door")).toHaveLength(2); // the right edge either side of the Notch
    expect(r.holes).toEqual([sq(2, 2, 2)]);
  });

  it("an outline pulled in across a Hole makes a Notch too", () => {
    const pulled = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 3, y: 10 }, { x: 0, y: 10 }];
    expect(normaliseArea(pulled, [sq(4, 6, 2)]).kind).toBe("notch");
  });

  it("refuses a split, an erase, a Hole touching the outline and a self-crossing outline", () => {
    expect(normaliseArea(outline, [rect(-1, 4, 12, 2)]).kind).toBe("split");
    expect(normaliseArea(outline, [sq(-1, -1, 12)]).kind).toBe("erase");
    expect(normaliseArea(outline, [[{ x: 0, y: 5 }, { x: 2, y: 4 }, { x: 2, y: 6 }]]).kind).toBe("touch");
    expect(normaliseArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }], [sq(4, 1, 1)]).kind).toBe("touch");
  });
});
