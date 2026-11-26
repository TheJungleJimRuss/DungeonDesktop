import type { Entry } from "../srd/monsters";
import type { MonsterData } from "../storage/customEntries";
import { CONDITIONS, splitTop } from "../srd/monsterForm";
import { DAMAGE_TYPES } from "../combat/damageTypes";
import { signed, type AbilityKey } from "../party/sheet";
import { joinBroken, joinWrapped, opens, readLines, type ReadResult } from "./normalize";

const SIZE = "(?:Tiny|Small|Medium|Large|Huge|Gargantuan)";
const HEAD = new RegExp(`^(${SIZE}(?: or ${SIZE})?) ([A-Za-z' ]+?)(?: \\(([^)]*)\\))?, ([A-Za-z ,'-]+)$`);
const AC = /^AC\s+(\d+)(?:\s*\(([^)]*)\))?\s*(.*)$/i;
const HP = /^HP\s+(\d+)(?:\s*\(([^)]*)\))?$/i;
const LABEL = /^(Speed|Skills|Vulnerabilities|Resistances|Immunities|Gear|Senses|Languages)\b\s*(.*)$/i;
const CR = /^CR\s+(\d+(?:\/\d+)?)\s*(?:\((.*)\))?$/i;
const SECTION = /^(Traits|Actions|Bonus Actions|Reactions|Legendary Actions)$/i;
const SECTION_KEY: Record<string, "traits" | "actions" | "bonusActions" | "reactions" | "legendaryActions"> = {
  traits: "traits", actions: "actions", "bonus actions": "bonusActions", reactions: "reactions", "legendary actions": "legendaryActions",
};
const TABLE_TOKEN = /^(?:Str|Dex|Con|Int|Wis|Cha|MOD|SAVE|[+-]?\d+)$/i;
const ABILITY_TOKEN = /^(?:Str|Dex|Con|Int|Wis|Cha)$/i;
const ENTRY = /^([A-Z][\w'-]*(?: (?:[A-Z][\w'-]*|of|the|and|or|in|to|a|with|from|for|on))*(?: \([^)]*\))?)\.\s+(\S.*)$/;
const SENTENCE_END = /[.!?]["')]?$/;

/** True when the Legendary Actions intro says only what the Stat Block already prints for `uses` (lair = uses + 1). */
function isStandardLegendaryIntro(intro: string, uses: number): boolean {
  const words = (s: string) => s.toLowerCase().replace(/the [a-z' -]+? can expend/, "the creature can expend").replace(/[^a-z0-9]+/g, " ").trim();
  const short = `Legendary Action Uses: ${uses}.`;
  const full = `Legendary Action Uses: ${uses} (${uses + 1} in Lair). Immediately after another creature's turn, the creature can expend a use to take one of the following actions. It regains all expended uses at the start of each of its turns.`;
  return words(intro) === words(short) || words(intro) === words(full);
}
const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

const num = (s: string) => Number(s.replace(/,/g, ""));
const canon = (word: string, list: readonly string[]) => list.find((x) => x.toLowerCase() === word.toLowerCase());
const entryName = (n: string) => n.replace(/(Recharge \d)-(\d)/, "$1–$2");

/** Reads the six score rows (three per line, or one value per line) into abilities and proficient saves. */
function readTable(tokens: string[]): { abilities?: MonsterData["abilities"]; saves: string[]; leftover: string[] } {
  const abilities: Partial<Record<AbilityKey, number>> = {};
  const saves: string[] = [];
  const leftover: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^(MOD|SAVE)$/i.test(token)) continue;
    const key = token.toLowerCase() as AbilityKey;
    const [score, mod, save] = tokens.slice(i + 1, i + 4);
    if (ABILITY_TOKEN.test(token) && [score, mod, save].every((x) => x !== undefined && /^[+-]?\d+$/.test(x))) {
      abilities[key] = Number(score);
      if (Number(mod) !== Number(save)) saves.push(`${token.toUpperCase()} ${signed(Number(save))}`);
      i += 3;
    } else leftover.push(token);
  }
  return { abilities: ABILITIES.every((a) => abilities[a] !== undefined) ? (abilities as MonsterData["abilities"]) : undefined, saves, leftover };
}

/** Reads a 2024-layout stat block (name, "Size Type, Alignment", AC/HP/Speed, score table, labelled lines, CR, entry sections). */
export function readMonster(text: string): ReadResult<MonsterData> {
  const lines = joinBroken(readLines(text));
  const fields: Partial<MonsterData> = {};
  const unread: string[] = [];
  const firstSection = lines.findIndex((l) => SECTION.test(l));
  const headEnd = firstSection < 0 ? lines.length : firstSection;
  let nameLine: string | undefined;
  let tableTokens: string[] | null = null;
  const set = <K extends keyof MonsterData>(k: K, v: MonsterData[K]) => { fields[k] = v; };

  for (let i = 0; i < headEnd; i++) {
    const line = lines[i];
    if (!line) continue;
    const tokens = line.split(" ");
    if (tokens.every((t) => TABLE_TOKEN.test(t)) && (tableTokens || tokens.some((t) => /^(?:Str|Dex|Con|Int|Wis|Cha|MOD|SAVE)$/i.test(t)))) {
      (tableTokens ??= []).push(...tokens);
      continue;
    }
    const head = HEAD.exec(line);
    const ac = AC.exec(line);
    const hp = HP.exec(line);
    const label = LABEL.exec(line);
    const cr = CR.exec(line);
    if (head && fields.size === undefined) {
      set("size", head[1]); set("type", `${head[2].trim()}${head[3] ? ` (${head[3]})` : ""}`.toLowerCase()); set("alignment", head[4].trim().toLowerCase());
    } else if (ac) {
      set("ac", Number(ac[1]));
      if (ac[2]) set("acNote", ac[2]);
      if (ac[3] && !/^Initiative\b/i.test(ac[3])) unread.push(ac[3]);
    } else if (/^Initiative\b/i.test(line)) continue;
    else if (hp) { set("hp", Number(hp[1])); if (hp[2]) set("hpRoll", hp[2]); }
    else if (cr) {
      const [a, b] = cr[1].split("/");
      set("cr", b ? Number(a) / Number(b) : Number(a));
      const xp = /XP\s+([\d,]+)/i.exec(cr[2] ?? ""), lair = /([\d,]+)\s+in lair/i.exec(cr[2] ?? ""), pb = /PB\s*\+?(\d+)/i.exec(cr[2] ?? "");
      if (xp) set("xp", num(xp[1]));
      if (lair) set("xpInLair", num(lair[1]));
      if (pb) set("pb", Number(pb[1]));
    } else if (label) {
      let value = label[2];
      // the value may sit on the next line, and wrap onto following ones
      const more = () => i + 1 < headEnd && lines[i + 1] && !LABEL.test(lines[i + 1]) && !CR.test(lines[i + 1]) && !AC.test(lines[i + 1]);
      while ((value === "" || /[,;]$/.test(value) || opens(value)) && more()) value = `${value} ${lines[++i]}`.trim();
      store(label[1].toLowerCase(), value);
    } else if (fields.size === undefined && nameLine === undefined && Object.keys(fields).length === 0) nameLine = line;
    else unread.push(line);
  }

  function store(key: string, value: string) {
    if (key === "speed") set("speed", value);
    else if (key === "skills") set("skills", splitTop(value, ","));
    else if (key === "vulnerabilities") set("vulnerabilities", splitTop(value, ",").map((d) => canon(d, DAMAGE_TYPES) ?? d));
    else if (key === "resistances") set("resistances", splitTop(value, ",").map((d) => canon(d, DAMAGE_TYPES) ?? d));
    else if (key === "immunities") {
      const [dmg, cond] = value.includes(";") ? value.split(";").map((p) => splitTop(p, ",")) : [splitTop(value, ","), []];
      const all = [...dmg];
      const conditions = [...cond];
      if (!value.includes(";")) for (let j = all.length - 1; j >= 0; j--) if (canon(all[j], CONDITIONS)) conditions.unshift(...all.splice(j, 1));
      set("immunities", all.map((d) => canon(d, DAMAGE_TYPES) ?? d));
      set("conditionImmunities", conditions.map((c) => canon(c, CONDITIONS) ?? c));
    } else if (key === "gear") set("gear", value);
    else if (key === "senses") set("senses", splitTop(value, ";").flatMap((p) => splitTop(p, ",")).join(", "));
    else if (key === "languages") {
      const parts = splitTop(value, ";").flatMap((seg) => {
        const tail = /^(.*?),?\s*(telepathy \d+ ft\.?)$/i.exec(seg);
        return tail && !/^telepathy/i.test(seg) ? [tail[1], tail[2].toLowerCase()] : [/^telepathy/i.test(seg) ? seg.toLowerCase() : seg];
      });
      set("languages", parts.filter(Boolean).join("; "));
    }
  }

  if (tableTokens) {
    const table = readTable(tableTokens);
    if (table.abilities) { set("abilities", table.abilities); set("saves", table.saves); }
    if (table.leftover.length || !table.abilities) unread.push((table.abilities ? table.leftover : tableTokens.filter((x) => !/^(MOD|SAVE)$/i.test(x))).join(" "));
  }

  // sections
  let section: ReturnType<typeof keyOf> | null = null;
  let current: { name: string; lines: string[] } | null = null;
  const entriesBySection: Record<string, { name: string; lines: string[] }[]> = {};
  const legendaryIntro: string[] = [];
  function keyOf(l: string) { return SECTION_KEY[l.toLowerCase()]; }
  for (let i = headEnd; i < lines.length; i++) {
    const line = lines[i];
    if (SECTION.test(line)) { section = keyOf(line); current = null; continue; }
    if (!section) continue;
    // a new entry starts only after a sentence ended (or a blank line), not mid-sentence
    const prevLine = i > headEnd ? lines[i - 1] : "";
    const m: RegExpExecArray | null = line && (!current || !prevLine || SENTENCE_END.test(prevLine)) ? ENTRY.exec(line) : null;
    if (m) { current = { name: entryName(m[1]), lines: [m[2]] }; (entriesBySection[section] ??= []).push(current); }
    else if (current) current.lines.push(line);
    else if (section === "legendaryActions" && line) legendaryIntro.push(line);
    else if (line) unread.push(line);
  }
  if (legendaryIntro.length) {
    const intro = legendaryIntro.join(" ");
    const uses = /Legendary Action Uses:\s*(\d+)/i.exec(intro);
    if (uses) set("legendaryUses", Number(uses[1]));
    // The Stat Block writes the standard intro itself, so only text that differs from it is reported as unread.
    if (!uses || !isStandardLegendaryIntro(intro, Number(uses[1]))) unread.push(intro);
  }
  for (const [k, list] of Object.entries(entriesBySection)) {
    const entries: Entry[] = list.map((e) => ({ name: e.name, desc: joinWrapped(e.lines).join("\n") }));
    (fields as Record<string, Entry[]>)[k] = entries;
  }

  if (nameLine !== undefined) { if (Object.keys(fields).length) return { name: nameLine, fields, unread }; unread.unshift(nameLine); }
  return { fields, unread };
}
