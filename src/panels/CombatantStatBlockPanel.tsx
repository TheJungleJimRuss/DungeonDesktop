import { useEffect, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { getMonster, type Monster } from "../srd/monsters";
import StatBlock from "../srd/StatBlock";
import { monsterFromEntry, useCustomEntries, CUSTOM_PREFIX } from "../storage/customEntries";
import { classLabel, listParty, type PartyMember } from "../storage/party";
import { useActiveEncounter } from "../storage/encounters";
import { useChangeVersion } from "../sync/changeBus";
import { pickCombatant, useCombatPick } from "../combat/combatSelection";
import type { Combatant } from "../combat/rules";
import { ABILITIES, abilityMod, signed } from "../party/sheet";
import { Loading } from "../ui/PanelStates";

function PartySheet({ campaignId, c }: { campaignId: string; c: Combatant }) {
  const [m, setM] = useState<PartyMember | null>(null);
  const version = useChangeVersion("party");
  useEffect(() => { void listParty(campaignId).then((l) => setM(l.find((x) => x.id === c.partyId) ?? l.find((x) => x.name === c.name) ?? null)); }, [campaignId, c.partyId, c.name, version]);
  return (
    <article className="party-sheet" aria-label={`${c.name} Party sheet`}>
      <h3 className="sb-name">{c.name}</h3>
      {m ? (
        <>
          <p className="sb-sub"><em>Level {m.level} {classLabel(m)}</em></p>
          <p className="sb-line"><strong>AC</strong> {m.ac}</p>
          <p className="sb-line"><strong>HP</strong> {c.hp} (max {m.maxHp})</p>
          {m.abilities && (
            <table className="sb-abilities" aria-label="Ability scores">
              <thead><tr>{ABILITIES.map((a) => <th key={a}>{a.toUpperCase()}</th>)}</tr></thead>
              <tbody><tr>{ABILITIES.map((a) => <td key={a} aria-label={a.toUpperCase()}>{m.abilities![a]} ({signed(abilityMod(m.abilities![a]))})</td>)}</tr></tbody>
            </table>
          )}
          <p className="sb-line"><strong>Passive Perception</strong> {m.passivePerception}</p>
          {m.notes && <p className="sb-line muted">{m.notes}</p>}
        </>
      ) : <p className="muted">HP {c.hp}. This Party member is no longer in the Party.</p>}
    </article>
  );
}

function CombatantMonster({ campaignId, c }: { campaignId: string; c: Combatant }) {
  const id = c.monsterId;
  const customs = useCustomEntries(campaignId);
  const [srd, setSrd] = useState<Monster | null | undefined>();
  const isCustom = !!id && id.startsWith(CUSTOM_PREFIX);
  useEffect(() => {
    let live = true;
    setSrd(undefined);
    if (id && !isCustom) void getMonster(id).then((m) => live && setSrd(m ?? null));
    return () => { live = false; };
  }, [id, isCustom]);
  if (!id) return <p className="muted">{c.name} has no Stat Block (HP {c.hp}).</p>;
  let m: Monster | null | undefined = srd;
  if (isCustom) {
    if (!customs) return <Loading label="Loading Stat Block…" />;
    const e = customs.find((x) => x.id === id.slice(CUSTOM_PREFIX.length) && x.kind === "monster");
    m = e ? monsterFromEntry(e) : null;
  }
  if (m === undefined) return <Loading label="Loading Stat Block…" />;
  if (m === null) return <p className="muted">The Stat Block for {c.name} is missing.</p>;
  return <StatBlock monster={{ ...m, name: c.name }} rollable />;
}

function CombatantStatBlock({ campaign }: PanelProps) {
  const enc = useActiveEncounter(campaign.id);
  const pick = useCombatPick(campaign.id);
  const stale = !!enc && !!pick && pick.activeId !== enc.activeId;
  // The turn moved on: drop the pick for good, so coming back to that turn later does not revive it.
  useEffect(() => { if (stale) pickCombatant(campaign.id, null); }, [stale, campaign.id]);
  if (!enc) return enc === null ? <p className="muted">Start an Encounter to see Stat Blocks here.</p> : null;
  const picked = pick && pick.activeId === enc.activeId ? enc.combatants.find((c) => c.id === pick.combatantId) : undefined;
  const c = picked ?? enc.combatants.find((x) => x.id === enc.activeId);
  if (!c) return <p className="muted">Add combatants to see their Stat Block here.</p>;
  return (
    <div>
      <p className="muted">{picked ? "Selected" : "Active turn"}: {c.name}</p>
      {c.kind === "party" ? <PartySheet campaignId={campaign.id} c={c} />
        : c.kind === "monster" ? <CombatantMonster campaignId={campaign.id} c={c} />
        : <p className="muted">{c.name} is an ad-hoc entry with no Stat Block (HP {c.hp}).</p>}
    </div>
  );
}

registerPanel({ id: "combatant-stat-block", title: "Combatant Stat Block", component: CombatantStatBlock });
