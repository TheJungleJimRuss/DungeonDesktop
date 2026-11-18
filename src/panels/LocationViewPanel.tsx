import { useState } from "react";
import type { PanelProps } from "./registry";
import {
  deleteLocation, selectLocation, setNpcLocation, updateLocation, useLocations, useSelectedLocationId, type Location,
} from "../storage/locations";
import { selectNpc, useNpcs } from "../storage/npcs";
import { Loading } from "../ui/PanelStates";
import { GUARD } from "../ui/unsaved";

function LocationForm({ loc, onDone }: { loc: Location; onDone: () => void }) {
  const [name, setName] = useState(loc.name);
  const [notes, setNotes] = useState(loc.notes);
  return (
    <form {...GUARD} className="npc-form" onSubmit={(e) => {
      e.preventDefault();
      if (!name.trim()) return;
      void updateLocation(loc.id, { name: name.trim(), notes }).then(onDone);
    }}>
      <label><span className="muted">Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label><span className="muted">Notes</span><textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <div className="row end">
        <button type="button" onClick={onDone}>Cancel</button>
        <button type="submit" className="primary">Save</button>
      </div>
    </form>
  );
}

export function LocationView({ campaign }: PanelProps) {
  const locations = useLocations(campaign.id);
  const npcs = useNpcs(campaign.id);
  const selected = useSelectedLocationId(campaign.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [toLink, setToLink] = useState("");

  if (!locations || !npcs) return <Loading />;
  const loc = locations.find((l) => l.id === selected);
  if (!loc) return <p className="muted">Select a location, or add a new one.</p>;
  if (editing === loc.id) return <LocationForm loc={loc} onDone={() => setEditing(null)} />;

  const here = npcs.filter((n) => n.locationId === loc.id);
  const others = npcs.filter((n) => n.locationId !== loc.id);
  return (
    <article className="npc-view location-view">
      <div className="row">
        <h3 className="grow">{loc.name}</h3>
        <button onClick={() => setEditing(loc.id)}>Edit</button>
        <button className="danger" onClick={() => setConfirming(true)}>Delete</button>
      </div>
      <h4>Notes</h4>
      {loc.notes.trim() ? <p className="location-notes">{loc.notes}</p> : <p className="muted">No notes.</p>}
      <h4>NPCs here</h4>
      {here.length === 0 ? <p className="muted">No NPCs linked here.</p> : (
        <ul className="npc-items">
          {here.map((n) => (
            <li key={n.id} className="row">
              <button className="grow npc-item" onClick={() => selectNpc(campaign.id, n.id)}>{n.name || "Unnamed"}</button>
              <button aria-label={`Unlink ${n.name || "Unnamed"}`} onClick={() => void setNpcLocation(n.id, null)}>Unlink</button>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <div className="row">
          <select className="grow" aria-label="NPC to link here" value={toLink} onChange={(e) => setToLink(e.target.value)}>
            <option value="">Choose an NPC</option>
            {others.map((n) => <option key={n.id} value={n.id}>{n.name || "Unnamed"}</option>)}
          </select>
          <button disabled={!toLink} onClick={() => { void setNpcLocation(toLink, loc); setToLink(""); }}>Link NPC</button>
        </div>
      )}
      {confirming && (
        <div className="backdrop">
          <div role="dialog" aria-modal="true" aria-labelledby="del-loc-title" className="dialog">
            <h2 id="del-loc-title">Delete "{loc.name}"?</h2>
            <p>Its NPCs stay, keeping "{loc.name}" as a free-text location tag.</p>
            <div className="row end">
              <button onClick={() => setConfirming(false)}>Cancel</button>
              <button className="danger" onClick={() => {
                setConfirming(false);
                selectLocation(campaign.id, null);
                void deleteLocation(loc.id);
              }}>Delete location</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
