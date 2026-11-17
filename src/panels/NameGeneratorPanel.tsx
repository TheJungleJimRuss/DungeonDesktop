import { useState } from "react";
import { STYLES, generateNames, type NameStyleId } from "../names/names";
import { getCampaign } from "../storage/campaigns";
import { listLocations } from "../storage/locations";
import { createNpc, emptyNpcDraft, selectNpc } from "../storage/npcs";
import { registerPanel, type PanelProps } from "./registry";

const COUNT = 6;

/** Social mode: hidden behind a Generate names button until needed; roll fantasy names and turn one into a saved NPC with a click. */
function NameGenerator({ campaign }: PanelProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<NameStyleId>("any");
  const [names, setNames] = useState<string[]>([]);
  const reroll = (s: NameStyleId = style) => setNames(generateNames(Math.random, s, COUNT));

  const create = async (name: string) => {
    const draft = { ...emptyNpcDraft(), name };
    // Read the party location at click time so it is never stale.
    const locId = (await getCampaign(campaign.id))?.partyLocationId;
    const loc = locId ? (await listLocations(campaign.id)).find((l) => l.id === locId) : undefined;
    if (loc) { draft.locationId = loc.id; draft.locationTag = loc.name; }
    const npc = await createNpc(campaign.id, draft);
    selectNpc(campaign.id, npc.id);
  };

  if (!open) {
    return (
      <div className="name-generator">
        <button className="primary" onClick={() => { reroll(); setOpen(true); }}>Generate names</button>
      </div>
    );
  }

  return (
    <div className="name-generator">
      <div className="row">
        <select className="grow" aria-label="Name style" value={style}
          onChange={(e) => { const s = e.target.value as NameStyleId; setStyle(s); reroll(s); }}>
          {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button className="primary" onClick={() => reroll()}>Reroll</button>
        <button onClick={() => setOpen(false)}>Hide</button>
      </div>
      <ul className="npc-items">
        {names.map((n) => (
          <li key={n} className="row">
            <span className="gen-name grow">{n}</span>
            <button aria-label={`Create NPC ${n}`} onClick={() => void create(n)}>Create NPC</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Legacy panel id kept registered; Modes offer names inside the NPC form instead.
export default registerPanel({ id: "name-generator", title: "Name Generator", component: NameGenerator });
