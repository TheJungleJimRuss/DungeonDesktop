import { areaPriorityOf, type AreaPriority, type MapLine } from "../storage/maps";
import type { Location } from "../storage/locations";
import { DEFAULT_AREA_COLOR, DEFAULT_AREA_KIND } from "./areas";
import { commitOnEnter } from "./fields";

type Area = NonNullable<MapLine["area"]>;
const CREATE = "__create";
const PRIORITIES: [AreaPriority, string][] = [["normal", "Normal"], ["medium", "Medium"], ["high", "High"], ["highest", "Highest"], ["always", "Always"]];

/** Under the canvas, for a selected closed Line: Make area, or its kind, color, name, Location link and Unmake area.
 *  Text inputs commit on blur/Enter (committing per keystroke remounts the input and drops focus). */
export function AreaEditor({ label, area, locations, onChange, onCreateLocation, subtracting, onSubtract, holeSelected, onRemoveHole }: {
  label: string; area?: Area; locations: Location[]; onChange: (change: (area: Area | undefined) => Area | undefined) => void; onCreateLocation: () => void;
  /** True while Subtract shape waits for a cutter (the button hides); `onSubtract` starts it. */
  subtracting: boolean; onSubtract: () => void;
  /** True while one of the Area's Holes is selected: "Remove hole" (`onRemoveHole`) shows. */
  holeSelected: boolean; onRemoveHole: () => void;
}) {
  if (!area) return <div className="row map-area-editor"><button onClick={() => onChange(() => ({ kind: DEFAULT_AREA_KIND, color: DEFAULT_AREA_COLOR }))}>Make area</button></div>;
  // Changes are functions of the stored Area, so quick successive commits (tabbing through fields) never overwrite each other.
  const patch = (p: Partial<Area>) => onChange((a) => a && { ...a, ...p });
  const without = (key: "name" | "locationId", add?: Partial<Area>) => onChange((a) => { if (!a) return a; const { [key]: _old, ...rest } = a; return { ...rest, ...add }; });
  const linked = locations.find((l) => l.id === area.locationId);
  return (
    <div className="row map-area-editor" role="group" aria-label={`Area of ${label}`}>
      <label>Kind <input aria-label="Area kind" defaultValue={area.kind} key={`k${area.kind}`} onKeyDown={commitOnEnter}
        onBlur={(e) => { const kind = e.target.value.trim(); if (kind && kind !== area.kind) patch({ kind }); else e.target.value = area.kind; }} /></label>
      <label>Color <input aria-label="Area color" type="color" defaultValue={area.color} key={`c${area.color}`} onBlur={(e) => { if (e.target.value !== area.color) patch({ color: e.target.value }); }} /></label>
      <label>Name <input aria-label="Area name" defaultValue={area.name ?? ""} key={`n${area.name ?? ""}`} placeholder={linked?.name} onKeyDown={commitOnEnter}
        onBlur={(e) => { const name = e.target.value.trim(); if (name !== (area.name ?? "")) without("name", name ? { name } : {}); }} /></label>
      <label>Location <select aria-label="Area location" value={linked ? linked.id : ""} onChange={(e) => {
        if (e.target.value === CREATE) return onCreateLocation();
        without("locationId", e.target.value ? { locationId: e.target.value } : linked && !area.name?.trim() ? { name: linked.name } : {}); // unlinking keeps the Location's name unless the Area has its own
      }}>
        <option value="">None</option>
        {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        <option value={CREATE}>Create location</option>
      </select></label>
      <label title="How far out the label stays: Normal hides it once the Area is narrower than its name, Medium once it is narrower than half its name, High keeps it while the Area is drawn, Highest keeps it 10x further out, Always keeps it at every zoom">Priority <select aria-label="Area priority" value={areaPriorityOf(area)}
        onChange={(e) => { const priority = e.target.value as AreaPriority; onChange((a) => { if (!a) return a; const { priority: _old, ...rest } = a; return priority === "normal" ? rest : { ...rest, priority }; }); }}>
        {PRIORITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select></label>
      <label title="A locked Area ignores single clicks (they reach what is under it); double-click it to select it"><input type="checkbox" aria-label="Area locked" checked={!!area.locked}
        onChange={(e) => { const locked = e.target.checked; onChange((a) => { if (!a) return a; const { locked: _old, ...rest } = a; return locked ? { ...rest, locked: true } : rest; }); }} /> Locked</label>
      {holeSelected && <button onClick={onRemoveHole} title="Fill this Hole back in (Delete)">Remove hole</button>}
      {!subtracting && <button onClick={onSubtract} title="Cut another Shape or Area out of this Area">Subtract shape</button>}
      <button onClick={() => onChange(() => undefined)}>Unmake area</button>
    </div>
  );
}
