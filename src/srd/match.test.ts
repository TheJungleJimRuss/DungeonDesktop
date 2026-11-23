import { matchSrd } from "./match";

const entries = [{ id: "wizard", name: "Wizard" }, { id: "rogue", name: "Rogue" }];

describe("matchSrd", () => {
  it("matches a name case-insensitively and trimmed", () => {
    expect(matchSrd("wizard", entries)).toEqual(entries[0]);
    expect(matchSrd("  ROGUE ", entries)).toEqual(entries[1]);
  });
  it("returns undefined for custom or blank text", () => {
    expect(matchSrd("Hexblade Knight", entries)).toBeUndefined();
    expect(matchSrd("", entries)).toBeUndefined();
    expect(matchSrd(undefined, entries)).toBeUndefined();
  });
});
