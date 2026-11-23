import { reachArea, walkSpeedFeet } from "./speed";

describe("walkSpeedFeet", () => {
  it.each([
    ["30 ft.", 30], ["40 ft., Fly 80 ft., Swim 40 ft.", 40], ["Walk 25 ft.", 25], ["0 ft., Fly 30 ft.", 0],
    ["Fly 60 ft.", null], ["", null], [undefined, null], ["fast", null],
  ])("%s → %s", (text, feet) => expect(walkSpeedFeet(text)).toBe(feet));
});

describe("reachArea", () => {
  const map = { width: 20, height: 15 };
  it("covers speed / square size squares in every direction, diagonals included", () => {
    expect(reachArea({ x: 10, y: 7 }, 30, 5, map)).toEqual({ x: 4, y: 1, w: 13, h: 13, squares: 6 });
  });
  it("clips at the map edge", () => {
    expect(reachArea({ x: 1, y: 0 }, 30, 5, map)).toEqual({ x: 0, y: 0, w: 8, h: 7, squares: 6 });
  });
  it("rounds partial squares down and handles no movement", () => {
    expect(reachArea({ x: 5, y: 5 }, 25, 10, map).squares).toBe(2);
    expect(reachArea({ x: 5, y: 5 }, 0, 5, map)).toEqual({ x: 5, y: 5, w: 1, h: 1, squares: 0 });
  });
});
