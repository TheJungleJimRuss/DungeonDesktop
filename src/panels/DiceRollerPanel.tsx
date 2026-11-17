import { useRef, useState, type FormEvent } from "react";
import { registerPanel } from "./registry";
import { requestRoll, useRollHistory } from "../dice/roller";
import type { AdvMode } from "../dice/dice";
import { useShortcut } from "../shortcuts/shortcuts";

export const DICE_SHORTCUT = "Alt+D";
export const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;

/** Builds a roller expression like "2d6+3" from the pickers. */
export function buildExpression(count: number, sides: number, bonus: number): string {
  const mod = bonus === 0 ? "" : bonus > 0 ? `+${bonus}` : `${bonus}`;
  return `${count}d${sides}${mod}`;
}

function DiceRoller() {
  const [count, setCount] = useState("1");
  const [sides, setSides] = useState(20);
  const [bonus, setBonus] = useState("0");
  const [mode, setMode] = useState<AdvMode>("normal");
  const [error, setError] = useState("");
  const countInput = useRef<HTMLInputElement>(null);
  const history = useRollHistory();
  useShortcut(DICE_SHORTCUT, "Focus dice roller", () => countInput.current?.focus());

  const n = Number(count);
  const b = Number(bonus);
  const singleD20 = n === 1 && sides === 20;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(n) || n < 1 || n > 100) { setError("Roll between 1 and 100 dice at a time."); return; }
    if (!Number.isInteger(b)) { setError("Bonus must be a whole number."); return; }
    const r = requestRoll(buildExpression(n, sides, b), singleD20 ? mode : "normal");
    setError(r.ok ? "" : r.error);
  }

  return (
    <div className="dice-roller">
      <form onSubmit={submit} className="dice-form" noValidate>
        <input ref={countInput} type="number" min={1} max={100} step={1} aria-label="Number of dice"
          className="dice-count" value={count} onChange={(e) => setCount(e.target.value)} />
        <select aria-label="Die type" value={sides} onChange={(e) => setSides(Number(e.target.value))}>
          {DIE_TYPES.map((s) => <option key={s} value={s}>d{s}</option>)}
        </select>
        <label className="dice-bonus">
          <span aria-hidden>+</span>
          <input type="number" step={1} aria-label="Bonus" value={bonus}
            onChange={(e) => setBonus(e.target.value)} />
        </label>
        <select aria-label="Advantage" value={mode} disabled={!singleD20}
          title={singleD20 ? undefined : "Advantage applies to a single d20"}
          onChange={(e) => setMode(e.target.value as AdvMode)}>
          <option value="normal">Normal</option>
          <option value="advantage">Advantage</option>
          <option value="disadvantage">Disadvantage</option>
        </select>
        <button type="submit">Roll</button>
      </form>
      <p className="muted dice-hint">Focus with {DICE_SHORTCUT}. Advantage applies to a single d20.</p>
      {error && <p role="alert" className="dice-error">{error}</p>}
      <ol className="dice-history" aria-label="Roll history">
        {history.map((r, i) => (
          <li key={history.length - i}>
            <strong>{r.total}</strong> <span className="muted">{r.expression}</span>{" "}
            <span className="dice-detail">
              {r.advantage
                ? `[${r.advantage.rolls.join(", ")}] ${r.advantage.mode}, kept ${r.advantage.kept}`
                : `[${r.dice.join(", ")}]`}
              {r.modifier ? ` ${r.modifier > 0 ? "+" : "-"} ${Math.abs(r.modifier)}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

registerPanel({ id: "dice-roller", title: "Dice Roller", component: DiceRoller });
