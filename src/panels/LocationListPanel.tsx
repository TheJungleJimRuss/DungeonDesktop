import { useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import {
  DEFAULT_LOCATION_TYPE, LOCATION_TYPES, createLocation, locationTypeOf, selectLocation, setLocationStarred,
  useLocations, useSelectedLocationId, type LocationType,
} from "../storage/locations";
import { useNpcs } from "../storage/npcs";
import { LocationView } from "./LocationViewPanel";
import { Loading, EmptyState } from "../ui/PanelStates";

function LocationListPanel({ campaign }: PanelProps) {
  const locations = useLocations(campaign.id);
  const npcs = useNpcs(campaign.id) ?? [];
  const selected = useSelectedLocationId(campaign.id);
  const [name, setName] = useState("");
  const [newType, setNewType] = useState<LocationType>(DEFAULT_LOCATION_TYPE);
  const [typeFilter, setTypeFilter] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setName("");
    void createLocation(campaign.id, { name: n, notes: "", type: newType }).then((l) => selectLocation(campaign.id, l.id));
  };

  if (!locations) return <Loading />;
  const shown = locations
    .filter((l) => (!typeFilter || locationTypeOf(l).id === typeFilter) && (!starredOnly || l.starred))
    .sort((a, b) => Number(!!b.starred) - Number(!!a.starred)); // stable: stars first, then by name
  return (
    <div className="location-list">
      <form className="row" onSubmit={add}>
        <input className="grow" aria-label="New location name" placeholder="New location name"
          value={name} onChange={(e) => setName(e.target.value)} />
        <select aria-label="New location type" value={newType} onChange={(e) => setNewType(e.target.value as LocationType)}>
          {LOCATION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button type="submit" className="primary">Add location</button>
      </form>
      {locations.length > 0 && (
        <div className="loc-filters">
          <select aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {LOCATION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button aria-pressed={starredOnly} onClick={() => setStarredOnly(!starredOnly)}>★ Starred only</button>
        </div>
      )}
      {locations.length === 0 ? (
        <EmptyState>No locations yet. Add one above.</EmptyState>
      ) : (
        shown.length === 0 ? <p className="muted">No locations match.</p> : (
        <ul className="npc-items">
          {shown.map((l) => {
            const count = npcs.filter((n) => n.locationId === l.id).length;
            const type = locationTypeOf(l);
            return (
              <li key={l.id} className="loc-row">
                <button className="npc-item" aria-pressed={selected === l.id} onClick={() => selectLocation(campaign.id, l.id)}>
                  <span className="name"><span className="loc-dot" style={{ background: type.color }} aria-hidden="true" /> {l.name}</span>
                  <span className="muted">{type.label} · {count === 1 ? "1 NPC" : `${count} NPCs`}</span>
                </button>
                <button className="star-btn" aria-pressed={!!l.starred} aria-label={`${l.starred ? "Unstar" : "Star"} ${l.name} in list`}
                  onClick={() => void setLocationStarred(l.id, !l.starred)}>{l.starred ? "★" : "☆"}</button>
              </li>
            );
          })}
        </ul>)
      )}
      <hr />
      <LocationView campaign={campaign} />
    </div>
  );
}

export default registerPanel({ id: "locations", title: "Locations", component: LocationListPanel });
