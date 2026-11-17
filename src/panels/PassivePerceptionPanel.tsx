import { useCallback, useEffect, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { useChangeVersion } from "../sync/changeBus";
import { listParty, type PartyMember } from "../storage/party";
import { highestPassive, passivePerceptionOf } from "../party/passive";
import { Loading, EmptyState } from "../ui/PanelStates";

function PassivePerceptionPanel({ campaign }: PanelProps) {
  const [members, setMembers] = useState<PartyMember[] | null>(null);
  const reload = useCallback(async () => setMembers(await listParty(campaign.id)), [campaign.id]);
  const version = useChangeVersion("party");
  useEffect(() => { void reload(); }, [reload, version]);

  if (!members) return <Loading />;
  const top = highestPassive(members);
  if (!top) return <EmptyState goTo="party">No party members yet.</EmptyState>;
  return (
    <div className="passive-perception">
      <p aria-label="Highest passive Perception"><strong>Highest: {top.value}</strong> ({top.names.join(", ")})</p>
      <ul className="npc-items" aria-label="Passive Perception per member">
        {members.map((m) => (
          <li key={m.id} aria-label={`${m.name} passive Perception`}>{m.name}: {passivePerceptionOf(m)}</li>
        ))}
      </ul>
    </div>
  );
}

export default registerPanel({ id: "passive-perception", title: "Passive Perception", component: PassivePerceptionPanel });
