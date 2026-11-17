import { useSyncExternalStore } from "react";
import { rollDice, type AdvMode, type Failure, type Rng, type RollResult } from "./dice";

/** Shared roller: other panels call requestRoll("1d20+5") and the result lands in the
 *  Dice Roller's history. History is per window and not persisted. */
let rng: Rng = Math.random;
let history: RollResult[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setRng(r: Rng) { rng = r; }
export function resetRolls() { history = []; rng = Math.random; emit(); }

export function requestRoll(expression: string, mode: AdvMode = "normal"): RollResult | Failure {
  const r = rollDice(expression, rng, mode);
  if (r.ok) { history = [r, ...history].slice(0, 50); emit(); }
  return r;
}

export function useRollHistory(): RollResult[] {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => history,
  );
}
