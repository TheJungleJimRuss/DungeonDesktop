import { useRef, useState, type FormEvent } from "react";
import { registerPanel } from "./registry";
import { requestRoll, useRollHistory } from "../dice/roller";
import type { AdvMode } from "../dice/dice";
import { useShortcut } from "../shortcuts/shortcuts";

export const DICE_SHORTCUT = "Alt+D";

function DiceRoller() {
  const [expr, setExpr] = useState("");
  const [mode, setMode] = useState<AdvMode>("normal");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const history = useRollHistory();
  useShortcut(DICE_SHORTCUT, "Focus dice roller", () => input.current?.focus());

  function submit(e: FormEvent) {
    e.preventDefault();
    const r = requestRoll(expr, mode);
    setError(r.ok ? "" : r.error);
  }

  return (
    <div className="dice-roller">
      <form onSubmit={submit} className="dice-form">
        <input ref={input} aria-label="Dice expression" placeholder="2d6+3" value={expr}
          onChange={(e) => setExpr(e.target.value)} aria-invalid={!!error} />
        <select aria-label="Advantage" value={mode} onChange={(e) => setMode(e.target.value as AdvMode)}>
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
