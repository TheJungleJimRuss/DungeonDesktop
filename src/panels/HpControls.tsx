import { useEffect, useState } from "react";
import { loadMonsters } from "../srd/monsters";
import { monsterFromEntry, useCustomEntries } from "../storage/customEntries";
import { requestRoll } from "../dice/roller";
import {
  applyDamage, applyHealing, isBloodied, isDefeated, isDying, isStable, maxHpOf, recordDeathSave, setDefeatMode, setMaxHp, setTempHp, tempHpOf,
  type Combatant, type Encounter,
} from "../combat/rules";

type Update = (fn: (e: Encounter) => Encounter) => void;

/** Hit-dice formula per monster id (SRD and custom), for "Roll HP". */
export function useHpRolls(campaignId: string): Record<string, string> {
  const [rolls, setRolls] = useState<Record<string, string>>({});
  const customs = useCustomEntries(campaignId);
  useEffect(() => {
    let live = true;
    void loadMonsters().then((srd) => {
      const all = [...srd, ...(customs ?? []).filter((e) => e.kind === "monster").map(monsterFromEntry)];
      if (live) setRolls(Object.fromEntries(all.filter((m) => m.hpRoll).map((m) => [m.id, m.hpRoll])));
    });
    return () => { live = false; };
  }, [customs]);
  return rolls;
}

export const rowStateClass = (c: Combatant) =>
  isDefeated(c) ? " defeated" : isDying(c) ? " dying" : isBloodied(c) ? " bloodied" : "";

/** Death save tally and buttons for a party member at 0 HP. */
function DeathSaves({ c, update }: { c: Combatant; update: Update }) {
  const s = c.deathSaves ?? { successes: 0, failures: 0 };
  if (isStable(c)) return <span className="hp-flag stable-flag">Stable</span>;
  if (!isDying(c)) return null;
  const record = (r: "success" | "failure") => update((e) => recordDeathSave(e, c.id, r));
  return (
    <span className="death-saves row" role="group" aria-label={`Death saves ${c.name}`}>
      <span className="hp-flag dying-flag">Dying</span>
      <span aria-label={`Death save successes ${c.name}`}>✓ {s.successes}/3</span>
      <span aria-label={`Death save failures ${c.name}`}>✗ {s.failures}/3</span>
      <button aria-label={`Death save success ${c.name}`} onClick={() => record("success")}>Success</button>
      <button aria-label={`Death save failure ${c.name}`} onClick={() => record("failure")}>Failure</button>
    </span>
  );
}

export function DefeatModeToggle({ enc, update }: { enc: Encounter; update: Update }) {
  return (
    <label className="row">
      <input type="checkbox" checked={enc.defeatMode === "remove"}
        onChange={(e) => update((x) => setDefeatMode(x, e.target.checked ? "remove" : "grey"))} />
      Remove defeated combatants
    </label>
  );
}

function MaxHpInput({ c, onCommit }: { c: Combatant; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(maxHpOf(c)));
  useEffect(() => setDraft(String(maxHpOf(c))), [c]);
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(n) && n !== maxHpOf(c)) onCommit(n);
  };
  return (
    <input className="init-input" type="number" min={0} aria-label={`Max HP ${c.name}`} value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />
  );
}

/** HP readout and quick damage / healing / temporary HP entry for one combatant. */
export function HpControls({ c, update, hpRoll }: { c: Combatant; update: Update; hpRoll?: string }) {
  const [amount, setAmount] = useState("");
  const typed = Number(amount);
  const valid = amount.trim() !== "" && Number.isFinite(typed) && typed > 0;
  const apply = (fn: (e: Encounter, id: string, n: number) => Encounter, n: number) => update((e) => fn(e, c.id, n));
  const entered = (fn: typeof applyDamage) => { if (valid) { apply(fn, typed); setAmount(""); } };
  const nudge = (d: number) => setAmount(String(Math.max(0, (Number.isFinite(typed) ? typed : 0) + d)));
  const temp = tempHpOf(c);
  const rollHp = () => {
    if (!hpRoll) return;
    const r = requestRoll(hpRoll);
    if (r.ok) apply(setMaxHp, Math.max(1, r.total));
  };
  return (
    <span className="hp-controls row">
      <span className="hp" aria-label={`HP ${c.name}`}>
        HP {c.hp}/{maxHpOf(c)}{temp > 0 && ` (+${temp} temp)`}
      </span>
      {isDefeated(c) && <span className="hp-flag defeated-flag">{c.kind === "party" ? "Dead" : "Defeated"}</span>}
      <DeathSaves c={c} update={update} />
      {isBloodied(c) && <span className="hp-flag bloodied-flag">Bloodied</span>}
      <input id={`amt-${c.id}`} className="init-input" type="number" min={1} placeholder="Amt" aria-label={`Amount ${c.name}`} value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); entered(applyDamage); } }} />
      <button type="button" aria-label={`Amount minus 5 ${c.name}`} onClick={() => nudge(-5)}>-5</button>
      <button type="button" aria-label={`Amount plus 5 ${c.name}`} onClick={() => nudge(5)}>+5</button>
      <button className="danger" disabled={!valid} onClick={() => entered(applyDamage)} aria-label={`Damage ${c.name}`}>Damage</button>
      <button disabled={!valid} onClick={() => entered(applyHealing)} aria-label={`Heal ${c.name}`}>Heal</button>
      <button disabled={!valid} onClick={() => entered(setTempHp)} aria-label={`Set temp HP ${c.name}`}>Temp HP</button>
      <label className="muted">Max <MaxHpInput c={c} onCommit={(n) => apply(setMaxHp, n)} /></label>
      {hpRoll && <button aria-label={`Roll HP ${c.name}`} title={hpRoll} onClick={rollHp}>Roll HP</button>}
    </span>
  );
}
