import { addCombatant, advanceTurn, newEncounter, setInitiative, type Encounter } from "./rules";
import { addCondition, type AppliedCondition, advanceTurnWithConditions, clearNotices, removeCondition } from "./conditions";

function two(): Encounter {
  let e = newEncounter("c1");
  e = addCombatant(e, { kind: "adhoc", name: "A", hp: 5, dexMod: 0, initiative: 20 });
  e = addCombatant(e, { kind: "adhoc", name: "B", hp: 5, dexMod: 0, initiative: 10 });
  return e;
}
const withCond = (i: number, c: AppliedCondition) => { const b = two(); return addCondition(b, b.combatants[i].id, c); };
const ids = (e: Encounter) => e.combatants.map((c) => c.id);
const conds = (e: Encounter, i: number) => e.combatants[i].conditions ?? [];

describe("conditions", () => {
  it("applies and removes a condition; reapplying replaces it", () => {
    const base = two();
    let e = addCondition(base, base.combatants[0].id, { id: "prone" });
    expect(conds(e, 0)).toEqual([{ id: "prone" }]);
    e = addCondition(e, e.combatants[0].id, { id: "prone", rounds: 3 });
    expect(conds(e, 0)).toEqual([{ id: "prone", rounds: 3, timing: "end" }]);
    e = removeCondition(e, e.combatants[0].id, "prone");
    expect(conds(e, 0)).toEqual([]);
  });
  it("ignores an unknown combatant and a non-positive duration", () => {
    const e = two();
    expect(addCondition(e, "nope", { id: "prone" })).toEqual(e);
    expect(conds(addCondition(e, e.combatants[0].id, { id: "prone", rounds: 0 }), 0)).toEqual([{ id: "prone" }]);
  });
  it("counts down at the end of the affected combatant's turn and warns on expiry", () => {
    let e = withCond(0, { id: "stunned", rounds: 2 });
    e = advanceTurnWithConditions(e); // A's turn ends -> 1 left
    expect(conds(e, 0)).toEqual([{ id: "stunned", rounds: 1, timing: "end" }]);
    expect(e.notices ?? []).toEqual([]);
    e = advanceTurnWithConditions(e); // B ends, round 2, A active
    e = advanceTurnWithConditions(e); // A ends -> expires
    expect(conds(e, 0)).toEqual([]);
    expect(e.notices).toEqual(["Stunned on A has ended."]);
    expect(clearNotices(e).notices).toEqual([]);
  });
  it("start-of-turn timing counts down when the combatant becomes active", () => {
    let e = withCond(1, { id: "blinded", rounds: 1, timing: "start" });
    e = advanceTurnWithConditions(e); // B becomes active
    expect(conds(e, 1)).toEqual([]);
    expect(e.notices).toEqual(["Blinded on B has ended."]);
  });
  it("conditions without a duration never tick", () => {
    let e = withCond(0, { id: "prone" });
    for (let i = 0; i < 4; i++) e = advanceTurnWithConditions(e);
    expect(conds(e, 0)).toEqual([{ id: "prone" }]);
  });
  it("matches advanceTurn for order and rounds", () => {
    const base = two();
    let a = base, b = base;
    for (let i = 0; i < 5; i++) { a = advanceTurn(a); b = advanceTurnWithConditions(b); }
    expect([b.activeId, b.round]).toEqual([a.activeId, a.round]);
  });
  it("is kept when initiative changes", () => {
    let e = withCond(0, { id: "prone", rounds: 2 });
    e = setInitiative(e, ids(e)[0], 1);
    expect(e.combatants.find((c) => c.name === "A")?.conditions).toHaveLength(1);
  });
});
