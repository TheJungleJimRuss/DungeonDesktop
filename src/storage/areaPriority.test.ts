import { describe, expect, it } from "vitest";
import { areaPriorityOf } from "./maps";

describe("areaPriorityOf", () => {
  it("reads absent as normal and the old major as high", () => {
    expect(areaPriorityOf(undefined)).toBe("normal");
    expect(areaPriorityOf({})).toBe("normal");
    expect(areaPriorityOf({ priority: "major" })).toBe("high");
    expect(areaPriorityOf({ priority: "highest" })).toBe("highest");
  });
});
