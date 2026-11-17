import { describe, expect, it } from "vitest";
import { formatDays, milesPerDay, terrainMultiplier, travelDays } from "./travel";

describe("travel maths (2024 pace)", () => {
  it("uses 18/24/30 miles per day", () => {
    expect(milesPerDay("slow", "")).toBe(18);
    expect(milesPerDay("normal", "road")).toBe(24);
    expect(milesPerDay("fast", "")).toBe(30);
  });
  it("halves speed on difficult terrain", () => {
    expect(terrainMultiplier("Difficult terrain")).toBe(0.5);
    expect(terrainMultiplier("mountain pass")).toBe(0.5);
    expect(terrainMultiplier("grassland")).toBe(1);
    expect(milesPerDay("normal", "swamp")).toBe(12);
  });
  it("computes days per pace", () => {
    expect(travelDays(120, "slow", "")).toBe(6.67);
    expect(travelDays(120, "normal", "")).toBe(5);
    expect(travelDays(120, "fast", "")).toBe(4);
    expect(travelDays(120, "normal", "mountains")).toBe(10);
    expect(travelDays(0, "normal", "")).toBe(0);
  });
  it("formats days", () => {
    expect(formatDays(5)).toBe("5 days");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(0.5)).toBe("under 1 day");
    expect(formatDays(6.67)).toBe("6.7 days");
  });
});
