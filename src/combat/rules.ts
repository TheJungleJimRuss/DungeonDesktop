/** Pure Encounter rules: numbering, initiative order, turns and rounds. No storage, no React. */
import type { AppliedCondition } from "./conditions";

export type CombatantKind = "party" | "monster" | "adhoc" | "lair";

export interface Combatant {
  id: string;
  kind: CombatantKind;
  name: string;
  /** Current HP (on a record from before HP tracking, the max). */
  hp: number;
  /** Maximum HP; absent on older records, where `hp` is the max. */
  maxHp?: number;
  /** Temporary HP, absorbed before HP; absent means 0. */
  tempHp?: number;
  /** Dexterity modifier added to the initiative roll (0 for party and ad-hoc). */
  dexMod: number;
  /** undefined until rolled or typed in. */
  initiative?: number;
  /** Source monster id (SRD id or `custom:<id>`), when it came from search. */
  monsterId?: string;
  /** Source Party member id, for kind "party" (the panel shows their sheet numbers). */
  partyId?: string;
  /** Conditions currently on this combatant (see ./conditions); absent means none. */
  conditions?: AppliedCondition[];
  /** Concentrating on a spell (spell name optional); absent when not concentrating. */
  concentrating?: { spell?: string };
  /** DC of the pending concentration save the DM was reminded of; cleared when dismissed. */
  concentrationCheckDc?: number;
  /** Legendary actions per round (3 for SRD creatures) and the uses left this round. */
  legendaryMax?: number;
  legendaryLeft?: number;
  /** For kind "lair": the round in which the DM used this lair action. */
  lairUsedRound?: number;
  /** Death saving throws for a party member at 0 HP; absent while above 0 HP. */
  deathSaves?: { successes: number; failures: number };
}

export interface Encounter {
  id: string;
  campaignId: string;
  combatants: Combatant[];
  round: number;
  /** The combatant whose turn it is; undefined while the Encounter is empty. */
  activeId?: string;
  startedAt: number;
  /** True once the DM has advanced a turn; before that the top of the order is always active. */
  started?: boolean;
  /** What happens at 0 HP: keep the combatant greyed out (default) or remove it. */
  defeatMode?: "grey" | "remove";
  /** Warnings from the last turn change (e.g. a condition ended); the DM dismisses them. */
  notices?: string[];
}

export type NewCombatant = Omit<Combatant, "id" | "initiative"> & { initiative?: number };

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);

export function newEncounter(campaignId: string): Encounter {
  return { id: crypto.randomUUID(), campaignId, combatants: [], round: 1, startedAt: Date.now() };
}

/** Descending initiative; unrolled last; ties and unrolled keep their current relative order. */
function sorted(list: Combatant[]): Combatant[] {
  const rank = (c: Combatant) => c.initiative ?? -Infinity;
  return list.map((c, i) => ({ c, i })).sort((a, b) => (rank(b.c) - rank(a.c)) || a.i - b.i).map((x) => x.c);
}

const withList = (e: Encounter, combatants: Combatant[]): Encounter => {
  const list = sorted(combatants);
  return { ...e, combatants: list, activeId: e.started ? (e.activeId ?? list[0]?.id) : list[0]?.id };
};

/** Adds a combatant. Copies of one monster become "Goblin 1", "Goblin 2", ... (the first is renamed once a second arrives). */
export function addCombatant(e: Encounter, input: NewCombatant): Encounter {
  let list = e.combatants;
  let name = input.name;
  if (input.kind === "lair" && list.some((c) => c.kind === "lair" && c.monsterId === input.monsterId)) return e;
  if (input.kind === "monster") {
    const same = (n: string) => n === input.name || new RegExp(`^${input.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\d+$`).test(n);
    const copies = list.filter((c) => c.kind === "monster" && same(c.name));
    if (copies.length) {
      list = list.map((c) => (copies.includes(c) && c.name === input.name ? { ...c, name: `${input.name} 1` } : c));
      const max = Math.max(0, ...copies.map((c) => Number(c.name.slice(input.name.length + 1)) || 1));
      name = `${input.name} ${max + 1}`;
    }
  }
  return withList(e, [...list, { ...input, name, maxHp: input.maxHp ?? input.hp, tempHp: input.tempHp ?? 0, id: crypto.randomUUID(), ...(input.legendaryMax ? { legendaryLeft: input.legendaryMax } : {}) }]);
}

export function removeCombatant(e: Encounter, id: string): Encounter {
  const i = e.combatants.findIndex((c) => c.id === id);
  const combatants = e.combatants.filter((c) => c.id !== id);
  let activeId = e.activeId;
  if (activeId === id) activeId = combatants[i % (combatants.length || 1)]?.id;
  return { ...e, combatants, activeId };
}

export function setInitiative(e: Encounter, id: string, initiative: number | undefined): Encounter {
  return withList(e, e.combatants.map((c) => (c.id === id ? { ...c, initiative } : c)));
}

/** Manual tie-break: swaps with the neighbour only if it has the same initiative. */
export function moveTie(e: Encounter, id: string, dir: "up" | "down"): Encounter {
  const i = e.combatants.findIndex((c) => c.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  const a = e.combatants[i], b = e.combatants[j];
  if (!a || !b || a.initiative === undefined || a.initiative !== b.initiative) return e;
  const list = [...e.combatants];
  [list[i], list[j]] = [b, a];
  return { ...e, combatants: list };
}

/** Defeated combatants are passed over, unless everyone is defeated (then plain order). */
const takesTurn = (e: Encounter) => (c: Combatant) => !isDefeated(c) || e.combatants.every(isDefeated);

export function advanceTurn(e: Encounter): Encounter {
  const n = e.combatants.length;
  if (!n) return e;
  const ok = takesTurn(e);
  let i = Math.max(0, e.combatants.findIndex((c) => c.id === e.activeId));
  let round = e.round;
  for (let step = 0; step < n; step++) {
    i += 1;
    if (i >= n) { i = 0; round += 1; }
    if (ok(e.combatants[i])) break;
  }
  return resetLegendary({ ...e, started: true, activeId: e.combatants[i].id, round }, e.combatants[i].id);
}

export function rewindTurn(e: Encounter): Encounter {
  const n = e.combatants.length;
  if (!n) return e;
  const ok = takesTurn(e);
  let i = Math.max(0, e.combatants.findIndex((c) => c.id === e.activeId));
  let round = e.round;
  for (let step = 0; step < n; step++) {
    if (i > 0) i -= 1;
    else if (round > 1) { i = n - 1; round -= 1; }
    else return e; // nothing earlier in round 1
    if (ok(e.combatants[i])) return { ...e, activeId: e.combatants[i].id, round };
  }
  return e;
}

// --- HP and defeat ---

export const maxHpOf = (c: Pick<Combatant, "hp" | "maxHp">) => c.maxHp ?? c.hp;
export const tempHpOf = (c: Pick<Combatant, "tempHp">) => c.tempHp ?? 0;
/** Bloodied: at half max HP or less, but still standing. */
export const isBloodied = (c: Pick<Combatant, "hp" | "maxHp">) => c.hp > 0 && c.hp * 2 <= maxHpOf(c);
type HpView = Pick<Combatant, "hp" | "maxHp"> & Partial<Pick<Combatant, "kind" | "deathSaves">>;
const atZero = (c: HpView) => maxHpOf(c) > 0 && c.hp <= 0;
const saves = (c: HpView) => c.deathSaves ?? { successes: 0, failures: 0 };
/** Defeated: 0 HP. A party member at 0 HP is only defeated after three failed death saves.
 *  An entry with no HP tracked (max 0) is never defeated. */
export const isDefeated = (c: HpView) => atZero(c) && (c.kind !== "party" || saves(c).failures >= 3);
/** Stable: a party member at 0 HP with three successful death saves. */
export const isStable = (c: HpView) => atZero(c) && c.kind === "party" && saves(c).successes >= 3 && saves(c).failures < 3;
/** Dying: a party member at 0 HP still rolling death saves. */
export const isDying = (c: HpView) => atZero(c) && c.kind === "party" && !isDefeated(c) && !isStable(c);

/** Record one death saving throw for a dying party member (each count stops at 3). */
export function recordDeathSave(e: Encounter, id: string, result: "success" | "failure"): Encounter {
  return mapOne(e, id, (c) => {
    if (!isDying(c)) return c;
    const s = saves(c);
    return { ...c, deathSaves: result === "success" ? { ...s, successes: Math.min(3, s.successes + 1) } : { ...s, failures: Math.min(3, s.failures + 1) } };
  });
}

const mapOne = (e: Encounter, id: string, fn: (c: Combatant) => Combatant): Encounter =>
  ({ ...e, combatants: e.combatants.map((c) => (c.id === id ? fn(c) : c)) });

const whole = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** Damage hits temporary HP first, then HP (floor 0). In "remove" mode a combatant that drops to 0 leaves the Encounter. */
export function applyDamage(e: Encounter, id: string, amount: number): Encounter {
  const dmg = whole(amount);
  const next = mapOne(e, id, (c) => {
    if (dmg > 0 && c.kind === "party" && atZero(c) && !isDefeated(c)) {
      const s = saves(c); // damage at 0 HP costs a death save (and a stable PC starts dying again)
      return { ...c, deathSaves: { successes: isStable(c) ? 0 : s.successes, failures: Math.min(3, s.failures + 1) } };
    }
    const absorbed = Math.min(tempHpOf(c), dmg);
    const dc = c.concentrating && dmg > 0 ? Math.max(concentrationDc(dmg), c.concentrationCheckDc ?? 0) : c.concentrationCheckDc;
    return { ...c, maxHp: maxHpOf(c), tempHp: tempHpOf(c) - absorbed, hp: Math.max(0, c.hp - (dmg - absorbed)), ...(dc ? { concentrationCheckDc: dc } : {}) };
  });
  const c = next.combatants.find((x) => x.id === id);
  return e.defeatMode === "remove" && c && isDefeated(c) ? removeCombatant(next, id) : next;
}

/** Healing raises HP up to max HP and does not touch temporary HP. */
export function applyHealing(e: Encounter, id: string, amount: number): Encounter {
  return mapOne(e, id, ({ deathSaves, ...c }) => {
    const hp = Math.min(maxHpOf(c), c.hp + whole(amount));
    return { ...c, maxHp: maxHpOf(c), hp, ...(hp <= 0 && deathSaves ? { deathSaves } : {}) };
  });
}

/** Temporary HP replaces the current pool (they do not stack). */
export const setTempHp = (e: Encounter, id: string, amount: number): Encounter =>
  mapOne(e, id, (c) => ({ ...c, tempHp: whole(amount) }));

/** Override max HP (rolled hit dice or typed). A full combatant stays full; otherwise HP is clamped to the new max. */
export function setMaxHp(e: Encounter, id: string, max: number): Encounter {
  const m = whole(max);
  return mapOne(e, id, (c) => ({ ...c, maxHp: m, hp: c.hp >= maxHpOf(c) ? m : Math.min(c.hp, m) }));
}

export const setDefeatMode = (e: Encounter, mode: "grey" | "remove"): Encounter => ({ ...e, defeatMode: mode });

// --- Concentration, legendary and lair actions ---

/** Save DC for a concentration check: the higher of 10 or half the damage (rounded down). */
export const concentrationDc = (damage: number) => Math.max(10, Math.floor(damage / 2));

/** Mark a combatant as concentrating (spell name optional). */
export const setConcentration = (e: Encounter, id: string, spell?: string): Encounter =>
  mapOne(e, id, (c) => ({ ...c, concentrating: spell?.trim() ? { spell: spell.trim() } : {} }));

export const clearConcentration = (e: Encounter, id: string): Encounter =>
  mapOne(e, id, ({ concentrating: _a, concentrationCheckDc: _b, ...c }) => c);

/** Dismiss the pending save reminder but keep concentrating. */
export const dismissConcentrationCheck = (e: Encounter, id: string): Encounter =>
  mapOne(e, id, ({ concentrationCheckDc: _x, ...c }) => c);

/** Spend legendary action uses (never below 0). */
export const spendLegendary = (e: Encounter, id: string, uses = 1): Encounter =>
  mapOne(e, id, (c) => (c.legendaryMax ? { ...c, legendaryLeft: Math.max(0, (c.legendaryLeft ?? c.legendaryMax) - whole(uses)) } : c));

/** Legendary uses refill at the start of the creature's own turn. */
const resetLegendary = (e: Encounter, id: string | undefined): Encounter =>
  id ? mapOne(e, id, (c) => (c.legendaryMax ? { ...c, legendaryLeft: c.legendaryMax } : c)) : e;

/** The DM used this lair action in the current round. */
export const markLairUsed = (e: Encounter, id: string): Encounter => mapOne(e, id, (c) => ({ ...c, lairUsedRound: e.round }));
