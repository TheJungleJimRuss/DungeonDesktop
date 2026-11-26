import { describe, expect, it } from "vitest";
import monsters from "../data/srd/monsters.json";
import type { Monster } from "./monsters";
import type { MonsterData } from "../storage/customEntries";
import {
  CR_OPTIONS, CR_XP, crToPb, attackText, attackToHit, splitTop, parseSpeed, formatSpeed, parseSenses, formatSenses,
  parseSaves, formatSaves, parseSkills, formatSkills, parseLanguages, formatLanguages, mergeDefenses, splitDefenses,
  toMonsterForm, fromMonsterForm, passivePerception, CONDITIONS, SIZES, MONSTER_TYPES, LANGUAGE_SUGGESTIONS,
} from "./monsterForm";
import { DAMAGE_TYPES } from "../combat/damageTypes";

const all = monsters as unknown as Monster[];
const strip = ({ id: _i, name: _n, ...rest }: Monster): MonsterData => rest;
const ab = { str: 10, dex: 14, con: 10, int: 10, wis: 16, cha: 10 };

describe("CR tables", () => {
  it("has an XP value for every CR option and the right PB", () => {
    expect(CR_OPTIONS).toHaveLength(34);
    for (const cr of CR_OPTIONS) expect(CR_XP[cr]).toBeGreaterThan(0);
    expect([0, 4, 5, 8, 9, 12, 13, 16, 17, 20, 21, 24, 25, 28, 29, 30].map(crToPb)).toEqual([2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9]);
    expect([CR_XP[0.125], CR_XP[10], CR_XP[30]]).toEqual([25, 5900, 155000]);
  });
  it("exports the dropdown lists", () => {
    expect([SIZES.length, MONSTER_TYPES.length, CONDITIONS.length, LANGUAGE_SUGGESTIONS.length]).toEqual([6, 15, 15, 19]);
  });
});

describe("splitTop", () => {
  it("ignores separators inside parentheses", () => {
    expect(splitTop("Primordial (Auran, Terran), Common", ",")).toEqual(["Primordial (Auran, Terran)", "Common"]);
  });
});

describe("speed", () => {
  it("parses and formats", () => {
    const s = parseSpeed("40 ft., Climb 40 ft., Fly 80 ft. (hover)");
    expect(s).toMatchObject({ walk: 40, climb: 40, fly: 80, hover: true, burrow: null, other: "" });
    expect(formatSpeed(s)).toBe("40 ft., Climb 40 ft., Fly 80 ft. (hover)");
    expect(formatSpeed(parseSpeed("30 ft., Swim 30 ft., Burrow 10 ft."))).toBe("30 ft., Burrow 10 ft., Swim 30 ft.");
  });
  it("keeps unknown parts in other", () => {
    const s = parseSpeed("30 ft., teleport 10 ft.");
    expect(s.other).toBe("teleport 10 ft.");
    expect(formatSpeed(s)).toBe("30 ft., teleport 10 ft.");
  });
});

describe("senses", () => {
  it("round-trips with computed Passive Perception and keeps the unimpeded note", () => {
    const str = "Blindsight 60 ft., Darkvision 120 ft. (unimpeded by magical darkness), Passive Perception 23";
    const s = parseSenses(str, 23);
    expect(s).toMatchObject({ blindsight: 60, darkvision: 120, darkvisionUnimpeded: true, passiveOverride: null });
    expect(formatSenses(s, 23)).toBe(str);
  });
  it("keeps a differing stored Passive Perception as an override", () => {
    const s = parseSenses("Darkvision 60 ft., Passive Perception 15", 13);
    expect(s.passiveOverride).toBe(15);
    expect(formatSenses(s, 13)).toBe("Darkvision 60 ft., Passive Perception 15");
  });
  it("always writes Passive Perception, and keeps unknown senses", () => {
    expect(formatSenses(parseSenses("", 10), 10)).toBe("Passive Perception 10");
    expect(formatSenses(parseSenses("Echolocation 30 ft., Passive Perception 10", 10), 10)).toBe("Echolocation 30 ft., Passive Perception 10");
  });
  it("computes Passive Perception from Perception or Wisdom", () => {
    expect(passivePerception(ab, [], 2)).toBe(13);
    expect(passivePerception(ab, [{ key: "perception", level: "proficient", bonus: null }], 2)).toBe(15);
    expect(passivePerception(ab, [{ key: "perception", level: "expertise", bonus: null }], 2)).toBe(17);
    expect(passivePerception(ab, [{ key: "perception", level: "proficient", bonus: 9 }], 2)).toBe(19);
  });
});

describe("saves and skills", () => {
  it("stores null when the bonus equals the automatic one", () => {
    const { saves, other } = parseSaves(["DEX +4", "WIS +9", "CON +0"], ab, 2); // dex 2+2=4 auto, wis 3+2=5 (9 override), con 0+2=2 (0 override)
    expect(saves).toEqual([{ ability: "dex", bonus: null }, { ability: "wis", bonus: 9 }, { ability: "con", bonus: 0 }]);
    expect(other).toEqual([]);
    expect(formatSaves(saves, other, ab, 2)).toEqual(["DEX +4", "CON +0", "WIS +9"]);
  });
  it("detects proficient, expertise and override skills; keeps unknown ones", () => {
    const { skills, other } = parseSkills(["Stealth +4", "Perception +7", "Arcana +1", "Basket Weaving +3"], ab, 2);
    expect(skills).toEqual([
      { key: "stealth", level: "proficient", bonus: null },
      { key: "perception", level: "expertise", bonus: null },
      { key: "arcana", level: "proficient", bonus: 1 },
    ]);
    expect(other).toEqual(["Basket Weaving +3"]);
    expect(formatSkills(skills, other, ab, 2)).toEqual(["Arcana +1", "Perception +7", "Stealth +4", "Basket Weaving +3"]);
  });
  it("auto bonuses follow the score and PB", () => {
    const rows = [{ key: "stealth", level: "proficient" as const, bonus: null }];
    expect(formatSkills(rows, [], { ...ab, dex: 18 }, 4)).toEqual(["Stealth +8"]);
  });
});

describe("languages", () => {
  it.each([
    "Common, Draconic", "Deep Speech; telepathy 120 ft.", "None", "Primordial (Auran, Terran)",
    "Blink Dog; understands Elvish and Sylvan but can’t speak them",
    "Understands Abyssal, Celestial, Infernal, and Primordial but can’t speak; telepathy 120 ft.",
    "Abyssal; telepathy 60 ft. (works only with creatures that understand Abyssal)",
  ])("round-trips %s", (s) => {
    const p = parseLanguages(s);
    expect(formatLanguages(p.languages, p.telepathy)).toBe(s);
  });
  it("extracts telepathy", () => {
    expect(parseLanguages("Common, Elvish; telepathy 60 ft.")).toEqual({ languages: ["Common", "Elvish"], telepathy: 60 });
    expect(formatLanguages(["Common"], 30)).toBe("Common; telepathy 30 ft.");
  });
});

describe("defenses", () => {
  it("puts standard types first in order, then other rows", () => {
    expect(mergeDefenses(["Bludgeoning from nonmagical attacks", "Fire", "acid"], DAMAGE_TYPES)).toEqual(["Acid", "Fire", "Bludgeoning from nonmagical attacks"]);
    expect(splitDefenses(["Fire", "Cold (in lair)"], DAMAGE_TYPES)).toEqual({ checked: ["Fire"], other: ["Cold (in lair)"] });
  });
});

describe("fromMonsterForm", () => {
  const base: MonsterData = { ...strip(all.find((m) => m.id === "aboleth")!), gear: "a rope", xpInLair: 123 };
  it("keeps untouched fields, drops blank entries and the unused legendaryUses", () => {
    const f = toMonsterForm(base, "Aboleth");
    f.traits.push({ name: "  ", desc: "" });
    f.legendaryActions = [{ name: "", desc: " " }];
    const out = fromMonsterForm(f, base);
    expect(out.gear).toBe("a rope");
    expect(out.xpInLair).toBe(123);
    expect(out.traits).toHaveLength(base.traits.length);
    expect(out.legendaryActions).toEqual([]);
    expect("legendaryUses" in out).toBe(false);
  });
  it("saves legendaryUses only with legendary actions (default 3)", () => {
    const f = toMonsterForm(base, "x");
    f.legendaryActions = [{ name: "Tail", desc: "Hits." }];
    expect(f.legendaryUses).toBe(3);
    expect(fromMonsterForm(f, base).legendaryUses).toBe(3);
  });
  it("computes Passive Perception on save", () => {
    const f = toMonsterForm(base, "x");
    f.skills = [{ key: "perception", level: "expertise", bonus: null }];
    f.senses.passiveOverride = null;
    const out = fromMonsterForm(f, base);
    expect(out.senses).toMatch(/Passive Perception (\d+)$/);
    expect(out.skills).toContain("Perception +" + (2 + 4 * 2));
  });
});

describe("SRD round-trip", () => {
  const norm = (a: string[]) => [...a].sort();
  const rt = all.map((m) => ({ m, out: fromMonsterForm(toMonsterForm(strip(m), m.name), strip(m)) }));
  it("keeps speed, senses, languages and every list equal (exact strings; defenses and saves/skills order-normalised)", () => {
    const bad: string[] = [];
    for (const { m, out } of rt) {
      if (out.speed !== m.speed) bad.push(`${m.id} speed: ${m.speed} -> ${out.speed}`);
      if (out.senses !== m.senses) bad.push(`${m.id} senses: ${m.senses} -> ${out.senses}`);
      if (out.languages !== m.languages) bad.push(`${m.id} languages: ${m.languages} -> ${out.languages}`);
      if (JSON.stringify(norm(out.saves)) !== JSON.stringify(norm(m.saves))) bad.push(`${m.id} saves: ${m.saves} -> ${out.saves}`);
      if (JSON.stringify(norm(out.skills)) !== JSON.stringify(norm(m.skills))) bad.push(`${m.id} skills: ${m.skills} -> ${out.skills}`);
      for (const k of ["vulnerabilities", "resistances", "immunities", "conditionImmunities"] as const)
        if (JSON.stringify(norm(out[k])) !== JSON.stringify(norm(m[k]))) bad.push(`${m.id} ${k}: ${m[k]} -> ${out[k]}`);
    }
    expect(bad).toEqual([]);
  });
  it("round-trips the whole record apart from the legendaryUses default", () => {
    const bad = rt.filter(({ m, out }) => {
      const { id: _i, name: _n, ...rest } = m;
      const a = { ...rest } as Record<string, unknown>, b = { ...out } as Record<string, unknown>;
      for (const k of ["saves", "skills", "vulnerabilities", "resistances", "immunities", "conditionImmunities"]) { a[k] = norm(a[k] as string[]); b[k] = norm(b[k] as string[]); }
      if (a.legendaryUses === undefined) delete b.legendaryUses;
      return JSON.stringify(Object.entries(a).sort()) !== JSON.stringify(Object.entries(b).sort());
    }).map(({ m }) => m.id);
    expect(bad).toEqual([]);
  });
  it("reports how many SRD monsters have a stored Passive Perception that differs from the computed one", () => {
    const n = all.filter((m) => toMonsterForm(strip(m)).senses.passiveOverride !== null).length;
    console.log(`passive overrides: ${n} of ${all.length}`);
    expect(n).toBeLessThan(all.length);
  });
  it("auto-detects most save/skill bonuses", () => {
    const f = all.map((m) => toMonsterForm(strip(m)));
    const lost = f.filter((x) => x.otherSaves.length || x.otherSkills.length).length;
    console.log(`monsters with unparsed saves/skills: ${lost}`);
    expect(lost).toBe(0);
  });
});

describe("attack text", () => {
  it("writes melee with two damage lines", () => {
    expect(attackText({ kind: "melee", toHit: 5, reach: 5, damage: [{ count: 1, die: 8, bonus: 3, type: "Slashing" }, { count: 1, die: 6, bonus: 0, type: "Fire" }] }))
      .toBe("Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Slashing damage plus 3 (1d6) Fire damage.");
  });
  it("writes ranged and both", () => {
    expect(attackText({ kind: "ranged", toHit: 4, range: { normal: 80, long: 320 }, damage: [{ count: 1, die: 8, bonus: 2, type: "Piercing" }] }))
      .toBe("Ranged Attack Roll: +4, range 80/320 ft. Hit: 6 (1d8 + 2) Piercing damage.");
    expect(attackText({ kind: "both", toHit: 4, reach: 5, range: { normal: 20, long: 60 }, damage: [{ count: 1, die: 6, bonus: 2, type: "Piercing" }] }))
      .toBe("Melee or Ranged Attack Roll: +4, reach 5 ft. or range 20/60 ft. Hit: 5 (1d6 + 2) Piercing damage.");
  });
  it("handles negative bonuses and a minimum average of 1", () => {
    expect(attackText({ kind: "melee", toHit: 0, reach: 5, damage: [{ count: 1, die: 4, bonus: -3, type: "Bludgeoning" }] }))
      .toBe("Melee Attack Roll: +0, reach 5 ft. Hit: 1 (1d4 − 3) Bludgeoning damage.");
  });
  it("computes to-hit", () => {
    expect([attackToHit(3, 2, true), attackToHit(3, 2, false)]).toEqual([5, 3]);
  });
});
