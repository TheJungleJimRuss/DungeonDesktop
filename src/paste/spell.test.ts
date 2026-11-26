import { readSpell } from "./spell";

const FROST = `Glimmer Lance
Level 3 Evocation (Sorcerer, Wizard)
Casting Time: Action
Range: 90 feet
Components: V, S, M (a sliver of glass)
Duration: Instantaneous
A shard of pale light streaks toward a creature you can see within range. The target makes a
Dexterity saving throw, taking 8d6 Radiant damage on a failed save, or half as much on a success.

Using a Higher-Level Spell Slot. The damage increases by 1d6 for each slot level above 3.`;

describe("readSpell", () => {
  it("reads a full leveled spell", () => {
    const r = readSpell(FROST);
    expect(r.name).toBe("Glimmer Lance");
    expect(r.fields).toEqual({
      level: 3, school: "Evocation", classes: ["Sorcerer", "Wizard"], ritual: false,
      castingTime: "Action", range: "90 feet", components: "V, S, M (a sliver of glass)", duration: "Instantaneous",
      desc: "A shard of pale light streaks toward a creature you can see within range. The target makes a Dexterity saving throw, taking 8d6 Radiant damage on a failed save, or half as much on a success.",
      higherLevel: "The damage increases by 1d6 for each slot level above 3.",
    });
    expect(r.unread).toEqual([]);
  });

  it("reads a cantrip as level 0 with Cantrip Upgrade as higher level", () => {
    const r = readSpell(`Mote of Dusk
Evocation Cantrip (Sorcerer, Warlock)
Casting Time: Action
Range: 60 feet
Components: V, S
Duration: Instantaneous
You hurl a mote of shadow at a creature. Make a ranged spell attack.

Cantrip Upgrade. The damage grows by 1d8 at levels 5, 11 and 17.`);
    expect(r.fields.level).toBe(0);
    expect(r.fields.school).toBe("Evocation");
    expect(r.fields.classes).toEqual(["Sorcerer", "Warlock"]);
    expect(r.fields.desc).toBe("You hurl a mote of shadow at a creature. Make a ranged spell attack.");
    expect(r.fields.higherLevel).toBe("The damage grows by 1d8 at levels 5, 11 and 17.");
  });

  it("sets ritual and keeps the casting time without 'or Ritual'", () => {
    const a = readSpell("Hush Ward\nLevel 1 Abjuration (Cleric)\nCasting Time: Action or Ritual\nRange: Self\nComponents: V\nDuration: 1 hour\nA quiet falls.");
    expect(a.fields.ritual).toBe(true);
    expect(a.fields.castingTime).toBe("Action");
    const b = readSpell("Hush Ward\nLevel 1 Abjuration (Cleric)\nCasting Time: 10 minutes or Ritual\nRange: Self\nComponents: V\nDuration: 1 hour\nA quiet falls.");
    expect(b.fields.castingTime).toBe("10 minutes");
    expect(b.fields.ritual).toBe(true);
    expect(readSpell(FROST).fields.ritual).toBe(false);
  });

  it("joins lines broken mid-sentence and reads labels without colons or on their own line", () => {
    const r = readSpell(`Glimmer Lance
Level 3 Evocation (Wizard)
Casting Time
Action
Range 90 feet
Components
V, S, M (a sliver of
glass)
Duration
Instantaneous
A shard of pale light
streaks toward a
creature.

A second paragraph here.`);
    expect(r.fields.castingTime).toBe("Action");
    expect(r.fields.range).toBe("90 feet");
    expect(r.fields.components).toBe("V, S, M (a sliver of glass)");
    expect(r.fields.duration).toBe("Instantaneous");
    expect(r.fields.desc).toBe("A shard of pale light streaks toward a creature.\n\nA second paragraph here.");
    expect(r.unread).toEqual([]);
  });

  it("normalises curly quotes, dashes, ligatures and non-breaking spaces", () => {
    const r = readSpell(`Glimmer Lance
Level 3 Evocation (Wizard)
Casting Time: 1 action
Range: 30–foot line
Components: V, S
Duration: Concentration, up to 1 minute
The target ﬁnds the ﬂare “blinding” — it’s a −2 penalty.`);
    expect(r.name).toBe("Glimmer Lance");
    expect(r.fields.level).toBe(3);
    expect(r.fields.range).toBe("30-foot line");
    expect(r.fields.desc).toBe(`The target finds the flare "blinding" - it's a -2 penalty.`);
  });

  it("puts unrecognised lines before the description in unread, never description text", () => {
    const r = readSpell(`Glimmer Lance
Level 3 Evocation (Wizard)
Casting Time: Action
Page 214
Range: 90 feet
Components: V
Duration: Instantaneous
Some description that is not unread.`);
    expect(r.unread).toEqual(["Page 214"]);
    expect(r.fields.desc).toBe("Some description that is not unread.");
  });

  it("returns only what was read and no name for unrecognised text", () => {
    const r = readSpell("hello there\nnothing to see");
    expect(r.name).toBeUndefined();
    expect(r.fields).toEqual({});
    const part = readSpell("Glimmer Lance\nRange: 90 feet");
    expect(part.name).toBe("Glimmer Lance");
    expect(part.fields).toEqual({ range: "90 feet" });
  });

  it("joins a wrapped level line", () => {
    const r = readSpell(`Dusk Grasp
Level 2 Necromancy (Cleric,
Wizard)
Casting Time: Action
Range: Touch
Components: V, S
Duration: 1 minute
A pale hand closes on a creature.`);
    expect(r.fields).toMatchObject({ level: 2, school: "Necromancy", classes: ["Cleric", "Wizard"] });
  });

  it.each(["Using a Higher-Level Spell Slot", "Cantrip Upgrade"])("reads a %s heading on its own line", (heading) => {
    const r = readSpell(`Dusk Grasp
Level 2 Necromancy (Wizard)
Casting Time: Action
Range: Touch
Components: V, S
Duration: 1 minute
A pale hand closes on a creature.

${heading}
The damage increases by 1d6.`);
    expect(r.fields.higherLevel).toBe("The damage increases by 1d6.");
    expect(r.fields.desc).toBe("A pale hand closes on a creature.");
  });
});
