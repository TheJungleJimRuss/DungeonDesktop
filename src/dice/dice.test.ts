import { parseDice, rollDice, seqRng } from "./dice";

// rng value r in [0,1) -> die face floor(r*sides)+1. For d6: 0 -> 1, 0.5 -> 4, 0.99 -> 6.
describe("dice expressions", () => {
  it("rolls multiple dice with a modifier", () => {
    const r = rollDice("2d6+3", seqRng([0.5, 0.99]));
    expect(r).toMatchObject({ ok: true, total: 4 + 6 + 3, dice: [4, 6], modifier: 3 });
  });
  it("sums several terms and subtracts", () => {
    const r = rollDice("1d20 + 1d4 - 2", seqRng([0.99, 0.5]));
    expect(r).toMatchObject({ ok: true, total: 20 + 3 - 2 });
  });
  it("a bare modifier-free die works, with a d prefix", () => {
    expect(rollDice("d8", seqRng([0.99]))).toMatchObject({ ok: true, total: 8 });
  });
  it("advantage keeps the higher d20 and shows both", () => {
    const r = rollDice("1d20+5", seqRng([0.0, 0.99]), "advantage");
    expect(r).toMatchObject({ ok: true, total: 25, advantage: { mode: "advantage", rolls: [1, 20], kept: 20 } });
  });
  it("disadvantage keeps the lower d20", () => {
    const r = rollDice("1d20", seqRng([0.0, 0.99]), "disadvantage");
    expect(r).toMatchObject({ ok: true, total: 1, advantage: { kept: 1, rolls: [1, 20] } });
  });
  it("advantage is ignored for expressions without a single d20", () => {
    const r = rollDice("2d6", seqRng([0.5, 0.5]), "advantage");
    expect(r).toMatchObject({ ok: true, total: 8 });
    expect((r as { advantage?: unknown }).advantage).toBeUndefined();
  });
  it.each(["", "abc", "2d", "d0", "0d6", "2d6+", "2d6 3", "1d1001", "101d6"])("rejects %j with a message", (bad) => {
    const r = rollDice(bad, seqRng([0]));
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error.length).toBeGreaterThan(5);
  });
  it("parses without rolling", () => {
    expect(parseDice("3d4-1")).toMatchObject({ ok: true });
  });
});
