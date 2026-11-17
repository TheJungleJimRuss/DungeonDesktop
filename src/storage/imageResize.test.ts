import { MAX_IMAGE_SIDE, targetSize } from "./imageResize";

describe("targetSize", () => {
  it("leaves images within the cap alone", () => {
    expect(targetSize(1000, 800)).toBeNull();
    expect(targetSize(2048, 2048)).toBeNull();
  });
  it("scales the longest side down to the cap keeping the aspect ratio", () => {
    expect(MAX_IMAGE_SIDE).toBe(2048);
    expect(targetSize(4000, 1000)).toEqual({ width: 2048, height: 512 });
    expect(targetSize(1000, 4096)).toEqual({ width: 500, height: 2048 });
    expect(targetSize(3000, 3000)).toEqual({ width: 2048, height: 2048 });
  });
  it("never produces a zero side", () => {
    expect(targetSize(100000, 10)).toEqual({ width: 2048, height: 1 });
  });
  it("accepts another cap", () => {
    expect(targetSize(400, 200, 100)).toEqual({ width: 100, height: 50 });
  });
});
