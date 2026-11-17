import { distanceFeet, distanceSquares } from "./measure";

describe("measure", () => {
  it("counts straight lines in squares", () => {
    expect(distanceSquares({ x: 1, y: 1 }, { x: 6, y: 1 })).toBe(5);
    expect(distanceSquares({ x: 2, y: 7 }, { x: 2, y: 3 })).toBe(4);
  });
  it("counts every diagonal step as one square (2024 rule)", () => {
    expect(distanceSquares({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3);
    expect(distanceSquares({ x: 0, y: 0 }, { x: 5, y: 2 })).toBe(5);
    expect(distanceSquares({ x: 4, y: 4 }, { x: 1, y: 2 })).toBe(3);
  });
  it("is zero for the same square", () => {
    expect(distanceSquares({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe(0);
    expect(distanceFeet({ x: 3, y: 3 }, { x: 3, y: 3 }, 5)).toBe(0);
  });
  it("multiplies by feet per square", () => {
    expect(distanceFeet({ x: 0, y: 0 }, { x: 4, y: 2 }, 5)).toBe(20);
    expect(distanceFeet({ x: 0, y: 0 }, { x: 4, y: 2 }, 10)).toBe(40);
    expect(distanceFeet({ x: 0, y: 0 }, { x: 3, y: 0 }, 2.5)).toBe(7.5);
  });
});
