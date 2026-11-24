import { useState } from "react";
import { combatantForLink, compositionOf, encounterFrom, linkKeyOf, summarize } from "../combat/saved";
import type { Encounter } from "../combat/rules";
import { listParty } from "../storage/party";
import { saveEncounter } from "../storage/encounters";
import { createEncounterMap, getMap, restoreTokens, snapshotTokens, updateMap } from "../storage/maps";
import {
  createSavedEncounter, deleteSavedEncounter, renameSavedEncounter, useSavedEncounters, type SavedEncounter,
} from "../storage/savedEncounters";

/** Shown inside a running Encounter: saves its composition (monsters and ad-hoc, no initiative) under a name. */
export function SaveEncounterControl({ campaignId, enc }: { campaignId: string; enc: Encounter }) {
  const [name, setName] = useState("");
  const members = compositionOf(enc);
  const save = async () => {
    if (!name.trim() || !members.length) return;
    const stored = enc.mapId ? await getMap(enc.mapId) : undefined;
    await createSavedEncounter(campaignId, name.trim(), members, stored ? { mapId: stored.id, tokens: snapshotTokens(stored, (id) => linkKeyOf(enc, id)) } : undefined);
    setName("");
  };
  return (
    <form className="row" aria-label="Save encounter" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <input aria-label="Saved encounter name" placeholder="Save as..." value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit" disabled={!name.trim() || !members.length}>Save encounter</button>
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
    const mapId = saved && saved.campaignId === campaignId ? saved.id : (await createEncounterMap(campaignId, s.name)).id;
    const enc = { ...base, mapId };
    await saveEncounter(enc);
    await updateMap(mapId, (m) => restoreTokens(m, s.tokens ?? [], (key) => combatantForLink(enc, key), enc.combatants));
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
