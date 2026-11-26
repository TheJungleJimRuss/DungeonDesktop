import { reachArea, walkSpeedFeet } from "./speed";

describe("walkSpeedFeet", () => {
  it.each([
    ["30 ft.", 30], ["40 ft., Fly 80 ft., Swim 40 ft.", 40], ["Walk 25 ft.", 25], ["0 ft., Fly 30 ft.", 0],
    ["30", 30], [" 35 ", 35], ["Walk 20", 20], ["30, Fly 60 ft.", 30], ["30 m", null],
    ["Fly 60 ft.", null], ["", null], [undefined, null], ["fast", null],
  ])("%s → %s", (text, feet) => expect(walkSpeedFeet(text)).toBe(feet));
});

describe("reachArea", () => {
  it("covers speed / 5 ft squares in every direction, diagonals included", () => {
    expect(reachArea({ x: 10, y: 7 }, 30)).toEqual({ x: 4, y: 1, w: 13, h: 13, squares: 6 });
  });
  it("is not clipped: the Map has no edge", () => {
    expect(reachArea({ x: 1, y: 0 }, 30)).toEqual({ x: -5, y: -6, w: 13, h: 13, squares: 6 });
  });
  it("rounds partial squares down and handles no movement", () => {
    expect(reachArea({ x: 5, y: 5 }, 27).squares).toBe(5);
    expect(reachArea({ x: 5, y: 5 }, 0)).toEqual({ x: 5, y: 5, w: 1, h: 1, squares: 0 });
  });
});
