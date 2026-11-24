import type { MapMarker } from "../storage/maps";
import type { Location } from "../storage/locations";
import { MARKER_ICON_IDS, MarkerGlyph } from "./icons";
import { commitOnEnter } from "./fields";

const CREATE = "__create";

/** Under the canvas, for a selected Marker: name, color, icon, note, Location link and Delete. Text fields commit on blur/Enter
 *  (committing per keystroke remounts the input and drops focus). Changes are functions of the stored Marker, so quick commits never overwrite each other. */
export function MarkerEditor({ marker, label, locations, onChange, onCreateLocation, onDelete }: {
  marker: MapMarker; label: string; locations: Location[]; onChange: (change: (m: MapMarker) => MapMarker) => void; onCreateLocation: () => void; onDelete: () => void;
}) {
  const patch = (p: Partial<MapMarker>) => onChange((m) => ({ ...m, ...p }));
  const linked = locations.find((l) => l.id === marker.locationId);
  return (
    <div className="map-marker-editor" role="group" aria-label={`Edit Marker ${label}`}>
      <div className="row">
        <label>Name {linked
          ? <input aria-label="Marker name" value={linked.name} readOnly title="Named by its Location" />
          : <input aria-label="Marker name" defaultValue={marker.name} key={`n${marker.name}`} onKeyDown={commitOnEnter}
              onBlur={(e) => { const name = e.target.value.trim(); if (name && name !== marker.name) patch({ name }); else e.target.value = marker.name; }} />}</label>
        <label>Color <input aria-label="Marker color" type="color" defaultValue={marker.color} key={`c${marker.color}`} onBlur={(e) => { if (e.target.value !== marker.color) patch({ color: e.target.value }); }} /></label>
        <label>Location <select aria-label="Marker location" value={linked ? linked.id : ""} onChange={(e) => {
          const v = e.target.value; // read now: the change function runs later, after the controlled select has re-rendered
          if (v === CREATE) return onCreateLocation();
          const keep = linked?.name.trim(); // unlinking keeps the Location's name as the Marker's own
          onChange(({ locationId: _old, ...m }) => (v ? { ...m, locationId: v } : { ...m, name: keep || m.name }));
        }}>
          <option value="">None</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          <option value={CREATE}>Create location</option>
        </select></label>
        <button className="danger" aria-label={`Delete Marker ${label}`} onClick={onDelete}>Delete</button>
      </div>
      <div className="row" role="group" aria-label="Marker icon">
        {MARKER_ICON_IDS.map((id) => (
          <button key={id} type="button" className="map-icon-btn" aria-label={`Icon ${id}`} title={id} aria-pressed={marker.icon === id} onClick={() => patch({ icon: id })}>
            <svg viewBox="-12 -12 24 24" width={22} height={22} aria-hidden="true"><MarkerGlyph icon={id} size={22} /></svg>
          </button>
        ))}
      </div>
      <label className="map-marker-note">Note <textarea aria-label="Marker note" rows={2} defaultValue={marker.note} key={`t${marker.note}`}
        onBlur={(e) => { if (e.target.value !== marker.note) patch({ note: e.target.value }); }} /></label>
    </div>
  );
}
