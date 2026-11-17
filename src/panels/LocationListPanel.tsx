import { useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { createLocation, selectLocation, useLocations, useSelectedLocationId } from "../storage/locations";
import { useNpcs } from "../storage/npcs";
import { LocationView } from "./LocationViewPanel";

function LocationListPanel({ campaign }: PanelProps) {
  const locations = useLocations(campaign.id);
  const npcs = useNpcs(campaign.id) ?? [];
  const selected = useSelectedLocationId(campaign.id);
  const [name, setName] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setName("");
    void createLocation(campaign.id, { name: n, notes: "" }).then((l) => selectLocation(campaign.id, l.id));
  };

  if (!locations) return <p className="muted">Loading...</p>;
  return (
    <div className="location-list">
      <form className="row" onSubmit={add}>
        <input className="grow" aria-label="New location name" placeholder="New location name"
          value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="primary">Add location</button>
      </form>
      {locations.length === 0 ? (
        <p className="muted">No locations yet. Add one above.</p>
      ) : (
        <ul className="npc-items">
          {locations.map((l) => {
            const count = npcs.filter((n) => n.locationId === l.id).length;
            return (
              <li key={l.id}>
                <button className="npc-item" aria-pressed={selected === l.id} onClick={() => selectLocation(campaign.id, l.id)}>
                  <span className="name">{l.name}</span>
                  <span className="muted">{count === 1 ? "1 NPC" : `${count} NPCs`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <hr />
      <LocationView campaign={campaign} />
    </div>
  );
}

export default registerPanel({ id: "locations", title: "Locations", component: LocationListPanel });
