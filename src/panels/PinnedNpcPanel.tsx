import { registerPanel, type PanelProps } from "./registry";
import { useNpcs } from "../storage/npcs";
import { NpcView } from "./NpcCardPanel";
import { unpinNpc, usePinnedNpcIds } from "../popout/pinnedNpc";

/** Shows the NPCs pinned to the Pop-out Window, stacked in pin order; does not follow the NPC selection. */
function PinnedNpcPanel({ campaign }: PanelProps) {
  const npcs = useNpcs(campaign.id);
  const pinned = usePinnedNpcIds(campaign.id);
  if (!npcs) return <p className="muted">Loading...</p>;
  return (
    <>
      {pinned.map((id) => {
        const npc = npcs.find((n) => n.id === id);
        const unpin = <button onClick={() => unpinNpc(campaign.id, id)}>Unpin{npc ? ` ${npc.name}` : ""}</button>;
        return npc
          ? <NpcView key={id} campaignId={campaign.id} npc={npc} actions={unpin} />
          : <div key={id}><p className="muted">A pinned NPC no longer exists.</p>{unpin}</div>;
      })}
    </>
  );
}

export default registerPanel({ id: "pinned-npc", title: "Pinned NPC", component: PinnedNpcPanel });
