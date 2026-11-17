import { useEffect, useState } from "react";
import { loadReference, type Condition } from "../srd/reference";
import { addCondition, clearNotices, removeCondition, type ConditionTiming } from "../combat/conditions";
import type { Combatant, Encounter } from "../combat/rules";

type Update = (fn: (e: Encounter) => Encounter) => void;

function useConditions(): Condition[] {
  const [list, setList] = useState<Condition[]>([]);
  useEffect(() => { let live = true; void loadReference().then((r) => { if (live) setList(r.conditions); }); return () => { live = false; }; }, []);
  return list;
}

/** Strips the SRD's **bold** markers for plain display. */
const plain = (s: string) => s.replace(/\*\*/g, "");

/** Condition chips for one combatant (click a chip for its rules text) plus an apply form. */
export function ConditionControls({ c, update }: { c: Combatant; update: Update }) {
  const all = useConditions();
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [rounds, setRounds] = useState("");
  const [timing, setTiming] = useState<ConditionTiming>("end");
  const byId = new Map(all.map((x) => [x.id, x]));
  const applied = c.conditions ?? [];
  const n = Number(rounds);
  const apply = () => {
    if (!pick) return;
    update((e) => addCondition(e, c.id, { id: pick, rounds: rounds.trim() !== "" && n >= 1 ? n : undefined, timing }));
    setPick(""); setRounds("");
  };
  const shown = open ? byId.get(open) : undefined;
  return (
    <span className="condition-controls row">
      <span className="condition-chips" aria-label={`Conditions ${c.name}`}>
        {applied.map((x) => {
          const name = byId.get(x.id)?.name ?? x.id;
          return (
            <span key={x.id} className="condition-chip">
              <button aria-label={`Condition ${name} on ${c.name}`} aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? null : x.id)}>
                {name}{x.rounds !== undefined && ` (${x.rounds})`}
              </button>
              <button aria-label={`Remove ${name} from ${c.name}`} onClick={() => update((e) => removeCondition(e, c.id, x.id))}>×</button>
            </span>
          );
        })}
      </span>
      <span className="condition-form">
      <select aria-label={`Condition to apply to ${c.name}`} value={pick} onChange={(e) => setPick(e.target.value)}>
        <option value="">Condition…</option>
        {all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <input className="init-input" type="number" min={1} placeholder="Rds" title="Rounds" aria-label={`Condition rounds ${c.name}`} value={rounds} onChange={(e) => setRounds(e.target.value)} />
      <select aria-label={`Condition countdown ${c.name}`} value={timing} onChange={(e) => setTiming(e.target.value as ConditionTiming)}>
        <option value="end" title="Counts down at end of turn">End</option>
        <option value="start" title="Counts down at start of turn">Start</option>
      </select>
      <button disabled={!pick} aria-label={`Apply condition to ${c.name}`} onClick={apply}>Apply</button>
      </span>
      {shown && (
        <span className="condition-rules" role="note" aria-label={`${shown.name} rules`}>
          <strong>{shown.name}.</strong> {plain(shown.desc)}
        </span>
      )}
    </span>
  );
}

/** Dismissible warnings from the last turn change (conditions that just ended). */
export function ConditionNotices({ enc, update }: { enc: Encounter; update: Update }) {
  if (!enc.notices?.length) return null;
  return (
    <div className="condition-notices" role="alert">
      {enc.notices.map((m) => <div key={m}>{m}</div>)}
      <button onClick={() => update(clearNotices)}>Dismiss</button>
    </div>
  );
}
