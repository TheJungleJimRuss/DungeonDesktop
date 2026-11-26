import { useState } from "react";
import { combatantForLink, compositionOf, encounterFrom, linkKeyOf, summarize } from "../combat/saved";
import type { Encounter } from "../combat/rules";
import { listParty } from "../storage/party";
import { saveEncounter } from "../storage/encounters";
import { createEncounterMap, getMap, restoreTokens, snapshotTokens, updateMap, writeMapView } from "../storage/maps";
import { BATTLE_PX_PER_SQUARE } from "../map/scale";
import {
  createSavedEncounter, deleteSavedEncounter, renameSavedEncounter, useSavedEncounters, type SavedEncounter,
} from "../storage/savedEncounters";

/** The tracker's top-row button: toggles the name field for saving the running Encounter. */
export function SaveEncounterButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return <button aria-expanded={open} onClick={onToggle}>Save encounter</button>;
}

/** Opened from SaveEncounterButton: saves the composition (monsters and ad-hoc, no initiative) under a name. */
export function SaveEncounterForm({ campaignId, enc, onClose }: { campaignId: string; enc: Encounter; onClose: () => void }) {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const members = compositionOf(enc);
  const save = async () => {
    const n = name.trim();
    if (!n || !members.length) return;
    const stored = enc.mapId ? await getMap(enc.mapId) : undefined;
    await createSavedEncounter(campaignId, n, members, stored ? { mapId: stored.id, tokens: snapshotTokens(stored, (id) => linkKeyOf(enc, id)), spot: enc.spot } : undefined);
    setName("");
    setSaved(n);
  };
  if (saved) {
    return (
      <p className="row" role="status" aria-label="Save encounter">
        <span>Saved "{saved}". Load it from Saved encounters once this fight ends.</span>
        <button className="link" onClick={onClose}>OK</button>
      </p>
    );
  }
  if (!members.length) {
    return (
      <p className="row muted" role="status" aria-label="Save encounter">
        <span>Add a monster or ad-hoc combatant to save this encounter (Party members are added on load).</span>
        <button className="link" onClick={onClose}>Close</button>
      </p>
    );
  }
  return (
    <form className="row" aria-label="Save encounter" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <input aria-label="Saved encounter name" placeholder="Name, e.g. Goblin ambush" autoFocus value={name}
        onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }} />
      <button type="submit" className="primary" disabled={!name.trim()}>Save</button>
      <button type="button" onClick={onClose}>Cancel</button>
    </form>
  );
}

function Row({ campaignId, s }: { campaignId: string; s: SavedEncounter }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(s.name);
  const load = async () => {
    const base = encounterFrom(campaignId, s.members, await listParty(campaignId));
    // The saved Map, or a blank one named after the saved encounter when it is gone.
    const saved = s.mapId ? await getMap(s.mapId) : undefined;
    const fresh = !(saved && saved.campaignId === campaignId);
    const mapId = fresh ? (await createEncounterMap(campaignId, s.name)).id : saved!.id;
    // Loading opens the fight where it was: the spot at battle scale.
    if (s.spot) writeMapView(mapId, { centre: s.spot, pxPerSquare: BATTLE_PX_PER_SQUARE });
    const enc = { ...base, mapId, ...(s.spot ? { spot: s.spot } : {}) };
    await saveEncounter(enc);
    await updateMap(mapId, (m) => restoreTokens(m, s.tokens ?? [], (key) => combatantForLink(enc, key), enc.combatants, s.spot));
  };
  const commit = () => {
    const n = draft.trim();
    if (n && n !== s.name) void renameSavedEncounter(s.id, n);
    setRenaming(false);
  };
  return (
    <li aria-label={s.name} className="row">
      {renaming ? (
        <input aria-label={`New name for ${s.name}`} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") setRenaming(false); }} />
      ) : <strong>{s.name}</strong>}
      <span className="muted">{summarize(s.members)}</span>
      <button className="primary" aria-label={`Load ${s.name}`} onClick={() => void load()}>Load</button>
      <button aria-label={`Rename ${s.name}`} onClick={() => { setDraft(s.name); setRenaming(true); }}>Rename</button>
      <button className="danger" aria-label={`Delete ${s.name}`} onClick={() => void deleteSavedEncounter(s.id)}>Delete</button>
    </li>
  );
}

/** Shown when no Encounter is running: load a saved composition as a fresh Encounter. */
export function SavedEncounterList({ campaignId }: { campaignId: string }) {
  const rows = useSavedEncounters(campaignId);
  if (!rows.length) return null;
  return (
    <div>
      <h3>Saved encounters</h3>
      <ul aria-label="Saved encounters" className="init-hits">
        {rows.map((s) => <Row key={s.id} campaignId={campaignId} s={s} />)}
      </ul>
    </div>
  );
}
