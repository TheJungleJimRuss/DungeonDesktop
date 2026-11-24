import { partyLocationAt, partyLocationInSquare } from "./party";
import type { MapLine, MapMarker } from "../storage/maps";

const marker = (id: string, x: number, y: number, locationId?: string): MapMarker => ({ id, x, y, name: id, color: "#000", icon: "pin", note: "", ...(locationId ? { locationId } : {}) });
const sq = (x: number, y: number, s: number) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const area = (id: string, s: number, locationId?: string): MapLine => ({ id, points: sq(0, 0, s), closed: true, segments: ["plain", "plain", "plain", "plain"], area: { kind: "Area", color: "#fff", ...(locationId ? { locationId } : {}) } });

describe("partyLocationAt", () => {
  it("finds a linked Marker within the hit radius (screen px) and ignores one outside or unlinked", () => {
    const m = { lines: [], markers: [marker("a", 5, 5, "L1"), marker("b", 8, 8)] };
    expect(partyLocationAt(m, { x: 5.2, y: 5 }, 40)).toBe("L1"); // 8 px
    expect(partyLocationAt(m, { x: 5.5, y: 5 }, 40)).toBeUndefined(); // 20 px
    expect(partyLocationAt(m, { x: 5.5, y: 5 }, 100)).toBeUndefined(); // zoomed in: 50 px
    expect(partyLocationAt(m, { x: 5.05, y: 5 }, 100)).toBe("L1"); // 5 px
    expect(partyLocationAt(m, { x: 8, y: 8 }, 40)).toBeUndefined();
  });
  it("picks the nearest of several Markers in reach", () => {
    const m = { lines: [], markers: [marker("a", 5, 5, "L1"), marker("b", 5.1, 5, "L2")] };
    expect(partyLocationAt(m, { x: 5.09, y: 5 }, 40)).toBe("L2");
  });
  it("finds the linked Area containing the point; the smallest of overlapping linked Areas wins", () => {
    const m = { lines: [area("big", 10, "L1"), area("small", 4, "L2")], markers: [] };
    expect(partyLocationAt(m, { x: 2, y: 2 }, 40)).toBe("L2");
    expect(partyLocationAt(m, { x: 7, y: 7 }, 40)).toBe("L1");
    expect(partyLocationAt(m, { x: 11, y: 11 }, 40)).toBeUndefined();
  });
  it("skips unlinked Areas, falling through to a linked one around them", () => {
    const m = { lines: [area("big", 10, "L1"), area("small", 4)], markers: [] };
    expect(partyLocationAt(m, { x: 2, y: 2 }, 40)).toBe("L1");
  });
  it("lets a Marker beat an Area", () => {
    const m = { lines: [area("big", 10, "L1")], markers: [marker("a", 2, 2, "L2")] };
    expect(partyLocationAt(m, { x: 2, y: 2 }, 40)).toBe("L2");
  });
});

describe("partyLocationInSquare", () => {
  it("counts a linked Marker anywhere inside the square, not just near its centre", () => {
    const m = { lines: [], markers: [marker("a", 3.05, 4.95, "L1"), marker("b", 4.5, 4.5), marker("c", 6.2, 4.5, "L3")] };
    expect(partyLocationInSquare(m, { x: 3, y: 4 })).toBe("L1");
    expect(partyLocationInSquare(m, { x: 2, y: 4 })).toBeUndefined(); // the Marker is in the next square
    expect(partyLocationInSquare(m, { x: 4, y: 4 })).toBeUndefined(); // unlinked
    expect(partyLocationInSquare(m, { x: 6, y: 4 })).toBe("L3");
  });
  it("falls back to the linked Area under the square's centre", () => {
    const m = { lines: [area("big", 10, "L1")], markers: [] };
    expect(partyLocationInSquare(m, { x: 2, y: 2 })).toBe("L1");
    expect(partyLocationInSquare(m, { x: 12, y: 2 })).toBeUndefined();
  });
});
