import { readMonster } from "./monster";

const WARDEN = `Gloomwick Warden
Large Aberration, Lawful Evil
AC 17 Initiative +7 (17)
HP 180 (19d10 + 76)
Speed 30 ft., Fly 60 ft. (hover)
MOD SAVE MOD SAVE MOD SAVE
Str 18 +4 +4 Dex 14 +2 +6 Con 18 +4 +4
Int 12 +1 +1 Wis 16 +3 +7 Cha 10 +0 +0
Skills Perception +7, Stealth +6
Vulnerabilities Fire
Resistances Cold, Lightning
Immunities Poison; Charmed, Poisoned
Gear Longsword, Shield
Senses Darkvision 120 ft.; Passive Perception 17
Languages Deep Speech, Telepathy 120 ft.
CR 13 (XP 10,000, or 11,500 in lair; PB +5)
Traits
Legendary Resistance (3/Day, or 4/Day in Lair). If the warden fails a saving throw, it can choose to succeed instead.
Actions
Multiattack. The warden makes two Slam attacks.
Slam. Melee Attack Roll: +9, reach 10 ft. Hit: 15 (2d8 + 6) Bludgeoning damage.
Eye Rays (Recharge 5–6). The warden fires a ray at one creature it can
see within 60 feet. The target must make a
Wisdom saving throw (DC 15) or be Charmed.

The charm ends after 1 minute.
Bonus Actions
Dim. The warden snuffs out a light within 30 feet.
Reactions
Flinch. The warden halves the damage it takes from one attack.
Legendary Actions
Legendary Action Uses: 3 (4 in Lair). Immediately after another creature's turn, the warden can expend a use to take one of the following actions. It regains all expended uses at the start of each of its turns.
Lash. The warden makes one Slam attack.`;

describe("readMonster", () => {
  it("reads a full 2024-layout block", () => {
    const r = readMonster(WARDEN);
    expect(r.name).toBe("Gloomwick Warden");
    expect(r.fields).toEqual({
      size: "Large", type: "aberration", alignment: "lawful evil",
      ac: 17, hp: 180, hpRoll: "19d10 + 76", speed: "30 ft., Fly 60 ft. (hover)",
      abilities: { str: 18, dex: 14, con: 18, int: 12, wis: 16, cha: 10 },
      saves: ["DEX +6", "WIS +7"],
      skills: ["Perception +7", "Stealth +6"],
      vulnerabilities: ["Fire"], resistances: ["Cold", "Lightning"], immunities: ["Poison"], conditionImmunities: ["Charmed", "Poisoned"],
      gear: "Longsword, Shield",
      senses: "Darkvision 120 ft., Passive Perception 17",
      languages: "Deep Speech; telepathy 120 ft.",
      cr: 13, xp: 10000, xpInLair: 11500, pb: 5,
      traits: [{ name: "Legendary Resistance (3/Day, or 4/Day in Lair)", desc: "If the warden fails a saving throw, it can choose to succeed instead." }],
      actions: [
        { name: "Multiattack", desc: "The warden makes two Slam attacks." },
        { name: "Slam", desc: "Melee Attack Roll: +9, reach 10 ft. Hit: 15 (2d8 + 6) Bludgeoning damage." },
        { name: "Eye Rays (Recharge 5–6)", desc: "The warden fires a ray at one creature it can see within 60 feet. The target must make a Wisdom saving throw (DC 15) or be Charmed.\nThe charm ends after 1 minute." },
      ],
      bonusActions: [{ name: "Dim", desc: "The warden snuffs out a light within 30 feet." }],
      reactions: [{ name: "Flinch", desc: "The warden halves the damage it takes from one attack." }],
      legendaryActions: [{ name: "Lash", desc: "The warden makes one Slam attack." }],
      legendaryUses: 3,
    });
    expect(r.unread).toEqual([]);
  });

  it("reads the score table when it is one value per line, and the AC note and Initiative on its own line", () => {
    const r = readMonster(`Pebble Imp
Tiny or Small Fey (Elemental), Chaotic Neutral
AC 15 (natural armor)
Initiative +2 (12)
HP 7 (2d4 + 2)
Speed 20 ft.
MOD
SAVE
Str
6
-2
-2
Dex
14
+2
+4
Con
12
+1
+1
Int
8
-1
-1
Wis
10
+0
+0
Cha
10
+0
+0
CR 1/4 (XP 50; PB +2)`);
    expect(r.fields).toMatchObject({
      size: "Tiny or Small", type: "fey (elemental)", alignment: "chaotic neutral", ac: 15, acNote: "natural armor",
      hp: 7, hpRoll: "2d4 + 2", abilities: { str: 6, dex: 14, con: 12, int: 8, wis: 10, cha: 10 }, saves: ["DEX +4"],
      cr: 0.25, xp: 50, pb: 2,
    });
    expect(r.fields.xpInLair).toBeUndefined();
    expect(r.unread).toEqual([]);
  });

  it("sorts conditions out of an Immunities line without a semicolon", () => {
    const r = readMonster(`Ash Wisp
Small Elemental, Neutral
AC 12
HP 5 (2d4)
Speed 0 ft., Fly 30 ft. (hover)
Immunities Fire, Poison, Poisoned, Prone
CR 0 (XP 10; PB +2)`);
    expect(r.fields.immunities).toEqual(["Fire", "Poison"]);
    expect(r.fields.conditionImmunities).toEqual(["Poisoned", "Prone"]);
    expect(r.fields.cr).toBe(0);
  });

  it("joins Live Text line breaks mid-entry and mid-name lines", () => {
    const r = readMonster(`Thistle Brute
Medium Plant, Unaligned
AC 11
HP 30 (4d8 + 12)
Speed 20 ft.
CR 1 (XP 200; PB +2)
Actions
Thorn Lash. Melee Attack Roll: +4, reach 10
ft. Hit: 7 (1d10 + 2) Piercing
damage.`);
    expect(r.fields.actions).toEqual([{ name: "Thorn Lash", desc: "Melee Attack Roll: +4, reach 10 ft. Hit: 7 (1d10 + 2) Piercing damage." }]);
  });

  it("lists header lines it cannot place, keeps everything else, and drops Initiative silently", () => {
    const r = readMonster(`Odd Thing
Medium Ooze, Unaligned
AC 8 Initiative -2 (8)
HP 22 (3d8 + 9)
Speed 10 ft.
Treasure Shiny buttons
CR 1/2 (XP 100; PB +2)`);
    expect(r.unread).toEqual(["Treasure Shiny buttons"]);
    expect(r.fields.ac).toBe(8);
    expect(r.fields.cr).toBe(0.5);
  });

  it("reads nothing from text that is not a stat block", () => {
    const r = readMonster("hello there\nthis is not a monster");
    expect(r.fields).toEqual({});
    expect(r.name).toBeUndefined();
    expect(r.unread).toEqual(["hello there", "this is not a monster"]);
  });

  it("joins wrapped header lines (HP, CR, size/alignment)", () => {
    const r = readMonster(`Mossback Hulk
Medium Plant,
Neutral
AC 12
HP 45 (6d10
+ 12)
CR 2 (XP 450; PB
+2)`);
    expect(r.fields).toMatchObject({ size: "Medium", type: "plant", alignment: "neutral", hp: 45, hpRoll: "6d10 + 12", cr: 2, xp: 450, pb: 2 });
    expect(r.unread).toEqual([]);
  });

  it("does not start an entry in the middle of a sentence", () => {
    const r = readMonster(`Mossback Hulk
Medium Plant, Neutral
Actions
Bite. Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage, and the target has the
Prone Condition. It must stand.`);
    expect(r.fields.actions).toHaveLength(1);
    expect(r.fields.actions?.[0].name).toBe("Bite");
  });

  it("does not report a standard legendary intro wrapped over lines (the Stat Block prints it)", () => {
    const r = readMonster(`Mire Hulk
Huge Plant, Unaligned
AC 15
Legendary Actions
Legendary Action Uses: 2 (3 in Lair). Immediately after another creature's turn, the mire
hulk can expend a use to take one of the following actions. It regains all expended uses at
the start of each of its turns.
Stomp. The hulk makes one Slam attack.`);
    expect(r.fields.legendaryUses).toBe(2);
    expect(r.unread).toEqual([]);
    expect(r.fields.legendaryActions).toEqual([{ name: "Stomp", desc: "The hulk makes one Slam attack." }]);
  });

  it("keeps the rest of a legendary intro in unread", () => {
    const r = readMonster(`Mossback Hulk
Medium Plant, Neutral
Legendary Actions
Legendary Action Uses: 3 (5 in Lair). Immediately after another creature's turn, the hulk can expend a use.
Sway. The hulk moves.`);
    expect(r.fields.legendaryUses).toBe(3);
    expect(r.unread).toEqual(["Legendary Action Uses: 3 (5 in Lair). Immediately after another creature's turn, the hulk can expend a use."]);
  });
});
