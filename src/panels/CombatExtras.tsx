import { useState } from "react";
import type { Monster } from "../srd/monsters";
import {
  clearConcentration, dismissConcentrationCheck, markLairUsed, removeCombatant, setConcentration, spendLegendary,
  type Combatant, type Encounter, type NewCombatant,
} from "../combat/rules";

type Update = (fn: (e: Encounter) => Encounter) => void;

/** Legendary uses default to 3 when a creature has legendary actions but no explicit count. */
export const legendaryMaxOf = (m: Monster) => (m.legendaryActions?.length ? (m.legendaryUses ?? 3) : undefined);

/** Combatants to add for a monster: itself, plus an initiative-20 lair entry when it has lair actions. */
export function monsterCombatants(m: Monster, base: NewCombatant): NewCombatant[] {
  const out: NewCombatant[] = [{ ...base, legendaryMax: legendaryMaxOf(m) }];
  if (m.lairActions?.length) out.push({ kind: "lair", name: `Lair actions (${m.name})`, hp: 0, dexMod: 0, initiative: 20, monsterId: m.id });
  return out;
}

/** Concentration marker, save reminder and legendary-use counter for one combatant. */
export function CombatExtras({ c, update }: { c: Combatant; update: Update }) {
  const [spell, setSpell] = useState("");
  return (
    <span className="combat-extras row">
      {c.concentrating ? (
        <>
          <span className="hp-flag">Concentrating{c.concentrating.spell ? `: ${c.concentrating.spell}` : ""}</span>
          <button aria-label={`Clear concentration ${c.name}`} onClick={() => update((e) => clearConcentration(e, c.id))}>End concentration</button>
        </>
      ) : (
        <>
          <input className="init-input" aria-label={`Concentration spell ${c.name}`} placeholder="Spell" value={spell} onChange={(e) => setSpell(e.target.value)} />
          <button aria-label={`Concentrate ${c.name}`} onClick={() => { update((e) => setConcentration(e, c.id, spell)); setSpell(""); }}>Concentrate</button>
        </>
      )}
      {c.concentrationCheckDc !== undefined && (
        <span role="alert" className="hp-flag defeated-flag">
          Call for a Constitution save, DC {c.concentrationCheckDc}
          <button aria-label={`Dismiss concentration save ${c.name}`} onClick={() => update((e) => dismissConcentrationCheck(e, c.id))}>Dismiss</button>
        </span>
      )}
      {c.legendaryMax !== undefined && (
        <span className="legendary">
          <span aria-label={`Legendary uses ${c.name}`}>Legendary {c.legendaryLeft ?? c.legendaryMax}/{c.legendaryMax}</span>
          <button aria-label={`Use legendary action ${c.name}`} disabled={(c.legendaryLeft ?? c.legendaryMax) <= 0} onClick={() => update((e) => spendLegendary(e, c.id))}>Use</button>
        </span>
      )}
    </span>
  );
}

/** Row body for an initiative-20 lair action entry. */
export function LairRow({ c, round, update }: { c: Combatant; round: number; update: Update }) {
  return (
    <span className="lair row">
      {c.lairUsedRound === round && <span className="hp-flag">Used this round</span>}
      <button aria-label={`Use lair action ${c.name}`} onClick={() => update((e) => markLairUsed(e, c.id))}>Use</button>
      <button aria-label={`Dismiss lair action ${c.name}`} onClick={() => update((e) => removeCombatant(e, c.id))}>Dismiss</button>
    </span>
  );
}
