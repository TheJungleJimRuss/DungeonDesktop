import { useMemo, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { usePartyLocation } from "../storage/campaigns";
import { useLocations } from "../storage/locations";
import { NEW_NPC, selectNpc, useNpcs, useSelectedNpcId } from "../storage/npcs";
import { NpcCard } from "./NpcCardPanel";
import { Loading, EmptyState } from "../ui/PanelStates";

const distinct = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

/** Prep shows every NPC; Social starts scoped to the Party's current location (a location filter overrides it). */
function NpcList({ campaign, social }: PanelProps & { social: boolean }) {
  const npcs = useNpcs(campaign.id);
  const selected = useSelectedNpcId(campaign.id);
  const [query, setQuery] = useState("");
  const [faction, setFaction] = useState("");
  const [location, setLocation] = useState("");
  const [atParty, setAtParty] = useState(true);
  const partyLocId = usePartyLocation(campaign.id);
  const partyLoc = (useLocations(campaign.id) ?? []).find((l) => l.id === partyLocId);
  const scoped = social && atParty && !!partyLoc && !location;

  const factions = useMemo(() => distinct((npcs ?? []).map((n) => n.factionTag)), [npcs]);
  const locations = useMemo(() => distinct((npcs ?? []).map((n) => n.locationTag)), [npcs]);
  const shown = (npcs ?? []).filter(
    (n) =>
      n.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!faction || n.factionTag.trim() === faction) &&
      (!location || n.locationTag.trim() === location) &&
      (!scoped || n.locationId === partyLoc?.id),
  );

  if (!npcs) return <Loading />;
  return (
    <div className="npc-list">
      <div className="row">
        <input type="search" className="grow" aria-label="Search NPCs by name" placeholder="Search by name"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="primary" onClick={() => selectNpc(campaign.id, NEW_NPC)}>New NPC</button>
      </div>
      <div className="row npc-filters">
        <select aria-label="Filter by faction" value={faction} onChange={(e) => setFaction(e.target.value)}>
          <option value="">All factions</option>
          {factions.map((f) => <option key={f}>{f}</option>)}
        </select>
        <select aria-label="Filter by location tag" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All locations</option>
          {locations.map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      {social && partyLoc && (
        <p className="muted row">
          <span className="grow">{scoped ? `At party location: ${partyLoc.name}` : "Showing all NPCs"}</span>
          {scoped ? (
            <button onClick={() => { setAtParty(false); setFaction(""); setLocation(""); }}>Show all NPCs</button>
          ) : (
            <button onClick={() => { setAtParty(true); setLocation(""); }}>Only at party location</button>
          )}
        </p>
      )}
      {npcs.length === 0 ? (
        <EmptyState>No NPCs yet. Create one with New NPC.</EmptyState>
      ) : shown.length === 0 ? (
        <p className="muted">No NPCs match.</p>
      ) : (
        <ul className="npc-items">
          {shown.map((n) => (
            <li key={n.id}>
              <button className="npc-item" aria-pressed={selected === n.id} onClick={() => selectNpc(campaign.id, n.id)}>
                <span className="name">{n.name || "Unnamed"}</span>
                <span className="muted">{[n.role, n.factionTag].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** List and the selected NPC's card side by side, in one panel. */
function NpcsPanel(props: PanelProps & { social: boolean }) {
  return (
    <div className="npc-split-wrap">
      <div className="npc-split">
        <NpcList {...props} />
        <section className="npc-split-card" aria-label="NPC card"><NpcCard campaign={props.campaign} /></section>
      </div>
    </div>
  );
}

const NpcListPanel = (props: PanelProps) => <NpcsPanel {...props} social={false} />;
const SocialNpcListPanel = (props: PanelProps) => <NpcsPanel {...props} social />;

registerPanel({ id: "social-npc-list", title: "NPCs", component: SocialNpcListPanel, notOnDashboard: true });
export default registerPanel({ id: "npc-list", title: "NPCs", component: NpcListPanel });
