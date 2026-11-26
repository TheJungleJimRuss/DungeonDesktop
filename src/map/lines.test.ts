import { splitSegment } from "./lines";
import type { MapLine } from "../storage/maps";

const line = (closed: boolean): MapLine => ({
  id: "a", closed, points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }],
  segments: closed ? ["wall", "door", "plain"] : ["wall", "door"],
});

describe("splitSegment", () => {
  it("adds a point inside a segment; both halves keep its type", () => {
    const out = splitSegment(line(false), 1, { x: 4, y: 2 });
    expect(out.points).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 4, y: 4 }]);
    expect(out.segments).toEqual(["wall", "door", "door"]);
  });
  it("splits the closing segment of a Shape by appending a point", () => {
    const out = splitSegment(line(true), 2, { x: 2, y: 2 });
    expect(out.points[3]).toEqual({ x: 2, y: 2 });
    expect(out.segments).toEqual(["wall", "door", "plain", "plain"]);
  });
  it("ignores an index that is not a segment", () => {
    expect(splitSegment(line(false), 5, { x: 0, y: 0 })).toEqual(line(false));
  });
});
