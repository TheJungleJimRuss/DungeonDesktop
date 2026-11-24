import { useEffect, useState } from "react";
import { encounterDifficulty } from "../combat/difficulty";
import type { Encounter } from "../combat/rules";
import { loadMonsters } from "../srd/monsters";
import { monsterFromEntry, useCustomEntries } from "../storage/customEntries";
import { listParty, type PartyMember } from "../storage/party";
import { useChangeVersion } from "../sync/changeBus";

/** Monster XP per monster id (SRD and custom), same lookup as useHpRolls. */
function useMonsterXp(campaignId: string): Record<string, number> {
  const [xp, setXp] = useState<Record<string, number>>({});
  const customs = useCustomEntries(campaignId);
  useEffect(() => {
    let live = true;
    void loadMonsters().then((srd) => {
      const all = [...srd, ...(customs ?? []).filter((e) => e.kind === "monster").map(monsterFromEntry)];
      if (live) setXp(Object.fromEntries(all.map((m) => [m.id, m.xp])));
    });
    return () => { live = false; };
  }, [customs]);
  return xp;
}

/** How hard the Encounter is for the party in it (or the whole Party when none are added), by the 2024 XP budget. */
export default function EncounterDifficulty({ campaignId, enc }: { campaignId: string; enc: Encounter }) {
  const [party, setParty] = useState<PartyMember[]>([]);
  const partyVersion = useChangeVersion("party");
  useEffect(() => { void listParty(campaignId).then(setParty); }, [campaignId, partyVersion]);
  const xpById = useMonsterXp(campaignId);

  const monsters = enc.combatants.filter((c) => c.kind === "monster" || c.kind === "adhoc");
  const real = enc.combatants.filter((c) => c.kind === "monster");
  if (!real.length || !party.length) return null;

  const inFight = new Set(enc.combatants.flatMap((c) => (c.kind === "party" && c.partyId ? [c.partyId] : [])));
  const fighting = party.filter((m) => inFight.has(m.id));
  const basis = fighting.length ? fighting : party;
  const xps = monsters.map((c) => (c.kind === "monster" && c.monsterId ? xpById[c.monsterId] : undefined) ?? 0);
  const uncounted = xps.filter((x) => !(x > 0)).length;
  const { total, budget, band } = encounterDifficulty(basis.map((m) => m.level), xps);
  const n = basis.length;

  return (
    <div className="init-difficulty" role="status" aria-label="Encounter difficulty">
      <strong>{band} · {total} XP</strong>
      {uncounted > 0 && <span className="muted"> · {uncounted} without XP not counted</span>}
      <div className="muted">
        Low {budget.low} · Moderate {budget.moderate} · High {budget.high} for {n} character{n === 1 ? "" : "s"}
        {n === 1 ? ` (level ${basis[0].level})` : ""}{fighting.length ? "" : " (whole party)"}
      </div>
    </div>
  );
}
