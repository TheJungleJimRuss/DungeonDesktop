import { abilityMod, addCombatant, advanceTurn, applyDamage, applyHealing, isBloodied, isDefeated, maxHpOf, newEncounter, rewindTurn, setDefeatMode, setInitiative, setMaxHp, setTempHp, moveTie, type Encounter } from "./rules";

const mk = (): Encounter => newEncounter("c1");

describe("abilityMod", () => {
  it("uses floor((score-10)/2)", () => {
    expect([1, 8, 9, 10, 11, 14, 15, 20, 30].map(abilityMod)).toEqual([-5, -1, -1, 0, 0, 2, 2, 5, 10]);
  });
});

describe("addCombatant", () => {
  it("auto-numbers copies of one monster, even the first once a second arrives", () => {
    let e = mk();
    e = addCombatant(e, { kind: "monster", name: "Goblin", hp: 7, dexMod: 2 });
    expect(e.combatants.map((c) => c.name)).toEqual(["Goblin"]);
    e = addCombatant(e, { kind: "monster", name: "Goblin", hp: 7, dexMod: 2 });
    expect(e.combatants.map((c) => c.name)).toEqual(["Goblin 1", "Goblin 2"]);
    e = addCombatant(e, { kind: "monster", name: "Goblin", hp: 7, dexMod: 2 });
    expect(e.combatants.map((c) => c.name)).toEqual(["Goblin 1", "Goblin 2", "Goblin 3"]);
    e = addCombatant(e, { kind: "monster", name: "Owlbear", hp: 59, dexMod: 1 });
    expect(e.combatants[3].name).toBe("Owlbear");
  });
});

describe("initiative order", () => {
  const three = () => {
    let e = mk();
    for (const n of ["A", "B", "C"]) e = addCombatant(e, { kind: "adhoc", name: n, hp: 5, dexMod: 0 });
    return e;
  };
  it("sorts by initiative descending, unrolled last, ties keep their order", () => {
    let e = three();
    const [a, b, c] = e.combatants.map((x) => x.id);
    e = setInitiative(e, a, 10);
    e = setInitiative(e, c, 15);
    expect(e.combatants.map((x) => x.name)).toEqual(["C", "A", "B"]);
    e = setInitiative(e, b, 10);
    expect(e.combatants.map((x) => x.name)).toEqual(["C", "A", "B"]);
  });
  it("tie-break moves a combatant past an equal one only", () => {
    let e = three();
    const [a, b, c] = e.combatants.map((x) => x.id);
    e = setInitiative(setInitiative(setInitiative(e, a, 10), b, 10), c, 5);
    e = moveTie(e, b, "up");
    expect(e.combatants.map((x) => x.name)).toEqual(["B", "A", "C"]);
    expect(moveTie(e, c, "up").combatants.map((x) => x.name)).toEqual(["B", "A", "C"]);
    expect(moveTie(e, b, "up").combatants.map((x) => x.name)).toEqual(["B", "A", "C"]);
  });
});

describe("turns", () => {
  const ready = () => {
    let e = mk();
    for (const [n, i] of [["A", 20], ["B", 10], ["C", 5]] as const) {
      e = addCombatant(e, { kind: "adhoc", name: n, hp: 5, dexMod: 0 });
      e = setInitiative(e, e.combatants.find((c) => c.name === n)!.id, i);
    }
    return e;
  };
  it("starts on the first combatant in round 1 and advances through rounds", () => {
    let e = ready();
    expect(e.round).toBe(1);
    expect(e.combatants.find((c) => c.id === e.activeId)?.name).toBe("A");
    e = advanceTurn(advanceTurn(e));
    expect(e.combatants.find((c) => c.id === e.activeId)?.name).toBe("C");
    e = advanceTurn(e);
    expect([e.round, e.combatants.find((c) => c.id === e.activeId)?.name]).toEqual([2, "A"]);
  });
  it("rewinds, stopping at the very start", () => {
    let e = advanceTurn(advanceTurn(advanceTurn(ready())));
    e = rewindTurn(e);
    expect([e.round, e.combatants.find((c) => c.id === e.activeId)?.name]).toEqual([1, "C"]);
    e = rewindTurn(rewindTurn(rewindTurn(e)));
    expect([e.round, e.combatants.find((c) => c.id === e.activeId)?.name]).toEqual([1, "A"]);
  });
  it("keeps the active combatant when the order changes", () => {
    let e = advanceTurn(ready());
    const b = e.activeId;
    e = setInitiative(e, e.combatants[2].id, 30);
    expect(e.activeId).toBe(b);
  });
});

describe("active combatant before turns start", () => {
  it("follows the top of the order until the DM advances", () => {
    let e = mk();
    e = addCombatant(e, { kind: "adhoc", name: "Slow", hp: 1, dexMod: 0 });
    e = setInitiative(e, e.combatants[0].id, 3);
    e = addCombatant(e, { kind: "adhoc", name: "Fast", hp: 1, dexMod: 0 });
    e = setInitiative(e, e.combatants[1].id, 18);
    expect(e.combatants.find((c) => c.id === e.activeId)?.name).toBe("Fast");
  });
});

describe("HP rules", () => {
  const one = (hp = 10) => addCombatant(mk(), { kind: "adhoc", name: "A", hp, dexMod: 0 });
  const get = (e: Encounter) => e.combatants[0];

  it("starts at full HP with no temporary HP", () => {
    expect(get(one())).toMatchObject({ hp: 10, maxHp: 10, tempHp: 0 });
  });
  it("damage is absorbed by temporary HP first, then HP, never below 0", () => {
    let e = setTempHp(one(), get(one()).id, 0);
    const id = get(e).id;
    e = setTempHp(e, id, 4);
    e = applyDamage(e, id, 3);
    expect(get(e)).toMatchObject({ hp: 10, tempHp: 1 });
    e = applyDamage(e, id, 4);
    expect(get(e)).toMatchObject({ hp: 7, tempHp: 0 });
    e = applyDamage(e, id, 99);
    expect(get(e).hp).toBe(0);
  });
  it("healing never exceeds max HP and leaves temporary HP alone", () => {
    let e = one();
    const id = get(e).id;
    e = applyDamage(e, id, 6);
    e = setTempHp(e, id, 3);
    e = applyHealing(e, id, 100);
    expect(get(e)).toMatchObject({ hp: 10, tempHp: 3 });
  });
  it("temporary HP replaces rather than stacks, and is never negative", () => {
    let e = one();
    const id = get(e).id;
    e = setTempHp(e, id, 5);
    e = setTempHp(e, id, 8);
    expect(get(e).tempHp).toBe(8);
    expect(get(setTempHp(e, id, -2)).tempHp).toBe(0);
  });
  it("bloodied at half HP or less, defeated at 0", () => {
    const c = (hp: number, maxHp: number) => ({ ...get(one()), hp, maxHp });
    expect(isBloodied(c(6, 10))).toBe(false);
    expect(isBloodied(c(5, 10))).toBe(true);
    expect(isBloodied(c(0, 10))).toBe(false);
    expect(isDefeated(c(0, 10))).toBe(true);
    expect(isDefeated(c(1, 10))).toBe(false);
    expect(isDefeated(c(0, 0))).toBe(false); // ad-hoc entry with no HP tracked
  });
  it("max HP override keeps a full combatant full and clamps a hurt one", () => {
    let e = one();
    const id = get(e).id;
    expect(get(setMaxHp(e, id, 20))).toMatchObject({ hp: 20, maxHp: 20 });
    e = applyDamage(e, id, 4);
    expect(get(setMaxHp(e, id, 20))).toMatchObject({ hp: 6, maxHp: 20 });
    expect(get(setMaxHp(e, id, 3))).toMatchObject({ hp: 3, maxHp: 3 });
  });
  it("defeat mode 'remove' drops a combatant that reaches 0, 'grey' keeps it", () => {
    let e = addCombatant(one(), { kind: "adhoc", name: "B", hp: 5, dexMod: 0 });
    const [a] = e.combatants;
    expect(applyDamage(e, a.id, 10).combatants).toHaveLength(2);
    e = setDefeatMode(e, "remove");
    expect(applyDamage(e, a.id, 10).combatants.map((c) => c.name)).toEqual(["B"]);
  });
  it("reads legacy records that only have hp", () => {
    const legacy = { id: "x", kind: "adhoc", name: "Old", hp: 9, dexMod: 0 } as const;
    expect(maxHpOf(legacy)).toBe(9);
    expect(isBloodied(legacy)).toBe(false);
    expect(isDefeated(legacy)).toBe(false);
  });
});

import { clearConcentration, dismissConcentrationCheck, setConcentration, concentrationDc, spendLegendary, markLairUsed, removeCombatant } from "./rules";

describe("concentration", () => {
  const withOne = (hp = 40) => {
    const e = addCombatant(mk(), { kind: "adhoc", name: "Mage", hp, dexMod: 0 });
    return { e, id: e.combatants[0].id };
  };
  it("concentrationDc is the higher of 10 or half the damage (rounded down)", () => {
    expect([1, 10, 20, 21, 22, 45].map(concentrationDc)).toEqual([10, 10, 10, 10, 11, 22]);
  });
  it("marks with an optional spell and clears", () => {
    let { e, id } = withOne();
    e = setConcentration(e, id, "Bless");
    expect(e.combatants[0].concentrating).toEqual({ spell: "Bless" });
    e = setConcentration(e, id);
    expect(e.combatants[0].concentrating).toEqual({});
    e = clearConcentration(e, id);
    expect(e.combatants[0].concentrating).toBeUndefined();
    expect(e.combatants[0].concentrationCheckDc).toBeUndefined();
  });
  it("damage to a concentrating combatant sets a check DC; the largest of several hits stands; dismissable", () => {
    let { e, id } = withOne();
    e = setConcentration(e, id, "Bless");
    e = applyDamage(e, id, 30);
    expect(e.combatants[0].concentrationCheckDc).toBe(15);
    e = applyDamage(e, id, 4);
    expect(e.combatants[0].concentrationCheckDc).toBe(15);
    e = dismissConcentrationCheck(e, id);
    expect(e.combatants[0].concentrationCheckDc).toBeUndefined();
    expect(e.combatants[0].concentrating).toEqual({ spell: "Bless" });
  });
  it("no reminder without concentration or without damage", () => {
    let { e, id } = withOne();
    expect(applyDamage(e, id, 8).combatants[0].concentrationCheckDc).toBeUndefined();
    e = setConcentration(e, id);
    expect(applyDamage(e, id, 0).combatants[0].concentrationCheckDc).toBeUndefined();
  });
});

describe("legendary actions", () => {
  const dragon = () => {
    let e = addCombatant(mk(), { kind: "monster", name: "Wyrm", hp: 100, dexMod: 0, legendaryMax: 3 });
    e = addCombatant(e, { kind: "adhoc", name: "Hero", hp: 10, dexMod: 0 });
    const [w, h] = [e.combatants[0].id, e.combatants[1].id];
    return { e: setInitiative(setInitiative(e, w, 5), h, 15), w, h };
  };
  it("starts full, spends, never below 0, and resets at the start of its own turn", () => {
    let { e, w } = dragon();
    expect(e.combatants.find((c) => c.id === w)!.legendaryLeft).toBe(3);
    e = spendLegendary(e, w, 2);
    expect(e.combatants.find((c) => c.id === w)!.legendaryLeft).toBe(1);
    e = spendLegendary(e, w, 5);
    expect(e.combatants.find((c) => c.id === w)!.legendaryLeft).toBe(0);
    e = advanceTurn(e); // Hero -> Wyrm: its turn starts
    expect(e.activeId).toBe(w);
    expect(e.combatants.find((c) => c.id === w)!.legendaryLeft).toBe(3);
  });
});

describe("lair actions", () => {
  it("adds one initiative-20 entry per source monster, usable and dismissable", () => {
    let e = addCombatant(mk(), { kind: "lair", name: "Lair: Wyrm", hp: 0, dexMod: 0, monsterId: "w", initiative: 20 });
    e = addCombatant(e, { kind: "lair", name: "Lair: Wyrm", hp: 0, dexMod: 0, monsterId: "w", initiative: 20 });
    e = addCombatant(e, { kind: "adhoc", name: "Hero", hp: 10, dexMod: 0, initiative: 25 });
    expect(e.combatants.map((c) => c.name)).toEqual(["Hero", "Lair: Wyrm"]);
    const id = e.combatants[1].id;
    expect(markLairUsed(e, id).combatants[1].lairUsedRound).toBe(1);
    expect(removeCombatant(e, id).combatants).toHaveLength(1);
  });
});
