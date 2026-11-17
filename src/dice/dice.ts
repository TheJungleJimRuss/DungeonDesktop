/** Pure dice-expression logic. The random source is injected so tests are deterministic. */
export type Rng = () => number; // [0, 1), like Math.random
export type AdvMode = "normal" | "advantage" | "disadvantage";

export interface Term { sign: 1 | -1; count: number; sides: number }
export interface Parsed { ok: true; terms: Term[]; modifier: number }
export interface Failure { ok: false; error: string }
export interface RollResult {
  ok: true;
  expression: string;
  /** Every die rolled (the kept d20 only, when advantage applies). */
  dice: number[];
  modifier: number;
  total: number;
  advantage?: { mode: "advantage" | "disadvantage"; rolls: [number, number]; kept: number };
}

const MAX_DICE = 100;
const MAX_SIDES = 1000;

/** Rng that returns the given values in turn (for tests). */
export function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

export function parseDice(input: string): Parsed | Failure {
  const bad = /[0-9d]\s+[0-9d]/i.test(input.trim());
  const text = input.replace(/\s+/g, "").toLowerCase();
  if (!text) return { ok: false, error: "Enter a dice expression, like 2d6+3." };
  if (bad || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(text)) {
    return { ok: false, error: `"${input.trim()}" is not a valid dice expression. Try 2d6+3 or 1d20-1.` };
  }
  const terms: Term[] = [];
  let modifier = 0;
  for (const m of text.matchAll(/([+-]?)(\d*)(d?)(\d*)/g)) {
    if (!m[0]) continue;
    const sign = m[1] === "-" ? -1 : 1;
    if (!m[3]) { modifier += sign * Number(m[2]); continue; }
    const count = m[2] === "" ? 1 : Number(m[2]);
    const sides = Number(m[4]);
    if (count < 1 || count > MAX_DICE) return { ok: false, error: `Roll between 1 and ${MAX_DICE} dice at a time.` };
    if (sides < 2 || sides > MAX_SIDES) return { ok: false, error: `Dice need 2 to ${MAX_SIDES} sides.` };
    terms.push({ sign, count, sides });
  }
  if (!terms.length) return { ok: false, error: "Include at least one die, like 1d20." };
  return { ok: true, terms, modifier };
}

const face = (rng: Rng, sides: number) => Math.floor(rng() * sides) + 1;

export function rollDice(expression: string, rng: Rng = Math.random, mode: AdvMode = "normal"): RollResult | Failure {
  const parsed = parseDice(expression);
  if (!parsed.ok) return parsed;
  const { terms, modifier } = parsed;
  const single20 = terms.length === 1 && terms[0].count === 1 && terms[0].sides === 20 && terms[0].sign === 1;
  const dice: number[] = [];
  let total = modifier;
  let advantage: RollResult["advantage"];
  if (single20 && mode !== "normal") {
    const rolls: [number, number] = [face(rng, 20), face(rng, 20)];
    const kept = mode === "advantage" ? Math.max(...rolls) : Math.min(...rolls);
    advantage = { mode, rolls, kept };
    dice.push(kept);
    total += kept;
  } else {
    for (const t of terms) {
      for (let i = 0; i < t.count; i++) {
        const d = face(rng, t.sides);
        dice.push(d);
        total += t.sign * d;
      }
    }
  }
  const result: RollResult = { ok: true, expression: expression.trim(), dice, modifier, total };
  if (advantage) result.advantage = advantage;
  return result;
}
