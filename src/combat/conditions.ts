/** Pure condition rules: apply, remove and tick durations (kept out of rules.ts, which other work shares). */
import { advanceTurn, type Combatant, type Encounter } from "./rules";

export type ConditionTiming = "start" | "end";

/** One condition on a combatant. `id` is the SRD condition id (e.g. "prone"). No `rounds` = lasts until removed. */
export interface AppliedCondition { id: string; rounds?: number; timing?: ConditionTiming }

/** Title-cased name for a condition id, used in warnings (the SRD data supplies the display name in the UI). */
const label = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

const mapOne = (e: Encounter, id: string, fn: (c: Combatant) => Combatant): Encounter =>
  ({ ...e, combatants: e.combatants.map((c) => (c.id === id ? fn(c) : c)) });

/** Applies a condition; the same condition on the same combatant is replaced (so its duration can be refreshed). */
export function addCondition(e: Encounter, combatantId: string, input: AppliedCondition): Encounter {
  const rounds = input.rounds !== undefined && Number.isFinite(input.rounds) && input.rounds >= 1 ? Math.floor(input.rounds) : undefined;
  const cond: AppliedCondition = rounds === undefined ? { id: input.id } : { id: input.id, rounds, timing: input.timing ?? "end" };
  return mapOne(e, combatantId, (c) => ({ ...c, conditions: [...(c.conditions ?? []).filter((x) => x.id !== input.id), cond] }));
}

export const removeCondition = (e: Encounter, combatantId: string, conditionId: string): Encounter =>
  mapOne(e, combatantId, (c) => ({ ...c, conditions: (c.conditions ?? []).filter((x) => x.id !== conditionId) }));

export const clearNotices = (e: Encounter): Encounter => ({ ...e, notices: [] });

/** Counts down one combatant's conditions of the given timing; returns the updated encounter and expiry warnings. */
function tick(e: Encounter, combatantId: string | undefined, timing: ConditionTiming): { enc: Encounter; notices: string[] } {
  const c = e.combatants.find((x) => x.id === combatantId);
  if (!c?.conditions?.some((x) => x.rounds !== undefined && (x.timing ?? "end") === timing)) return { enc: e, notices: [] };
  const notices: string[] = [];
  const conditions = c.conditions.flatMap((x) => {
    if (x.rounds === undefined || (x.timing ?? "end") !== timing) return [x];
    if (x.rounds <= 1) { notices.push(`${label(x.id)} on ${c.name} has ended.`); return []; }
    return [{ ...x, rounds: x.rounds - 1 }];
  });
  return { enc: mapOne(e, c.id, (k) => ({ ...k, conditions })), notices };
}

/** advanceTurn plus condition countdown: "end" conditions tick when the outgoing combatant's turn ends, "start" ones when the incoming turn begins. Expiries become `notices` (replacing earlier ones). */
export function advanceTurnWithConditions(e: Encounter): Encounter {
  if (!e.combatants.length) return e;
  const outgoing = e.combatants.some((c) => c.id === e.activeId) ? e.activeId : e.combatants[0].id;
  const a = tick(e, outgoing, "end");
  const moved = advanceTurn(a.enc);
  const b = tick(moved, moved.activeId, "start");
  return { ...b.enc, notices: [...a.notices, ...b.notices] };
}
