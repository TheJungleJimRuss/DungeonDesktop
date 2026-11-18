import { useCallback, useEffect, useState, type FormEvent } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { useChangeVersion } from "../sync/changeBus";
import {
  addPinnedNote, listPinnedNotes, movePinnedNote, removePinnedNote, updatePinnedNote, type PinnedNote,
} from "../storage/notes";
import { EmptyState } from "../ui/PanelStates";
import { GUARD } from "../ui/unsaved";

function PinnedNotesPanel({ campaign }: PanelProps) {
  const [notes, setNotes] = useState<PinnedNote[] | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const refresh = useCallback(async () => setNotes(await listPinnedNotes(campaign.id)), [campaign.id]);
  const version = useChangeVersion("notes");
  useEffect(() => {
    let live = true;
    void listPinnedNotes(campaign.id).then((n) => live && setNotes(n));
    return () => { live = false; };
  }, [campaign.id, version]);

  const act = (fn: () => Promise<void>) => async () => { await fn(); await refresh(); };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    await addPinnedNote(campaign.id, draft);
    setDraft("");
    await refresh();
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editing.text.trim()) await updatePinnedNote(editing.id, editing.text);
    setEditing(null);
    await refresh();
  };

  return (
    <div className="pinned-notes">
      <form className="row" onSubmit={add}>
        <input className="grow" aria-label="New pinned note" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="primary" type="submit">Add note</button>
      </form>
      {notes && notes.length === 0 && <EmptyState>No pinned notes yet.</EmptyState>}
      <ul className="note-list">
        {notes?.map((n, i) => (
          <li key={n.id} className="row">
            {editing?.id === n.id ? (
              <form {...GUARD} className="row grow" onSubmit={save}>
                <input className="grow" aria-label="Edit note" autoFocus value={editing.text}
                  onChange={(e) => setEditing({ id: n.id, text: e.target.value })} />
                <button type="submit" className="primary">Save note</button>
                <button type="button" onClick={() => setEditing(null)}>Cancel</button>
              </form>
            ) : (
              <>
                <span className="grow" data-note-text>{n.text}</span>
                <button aria-label={`Move up: ${n.text}`} disabled={i === 0}
                  onClick={act(() => movePinnedNote(campaign.id, n.id, -1))}>↑</button>
                <button aria-label={`Move down: ${n.text}`} disabled={i === notes.length - 1}
                  onClick={act(() => movePinnedNote(campaign.id, n.id, 1))}>↓</button>
                <button aria-label={`Edit note: ${n.text}`} onClick={() => setEditing({ id: n.id, text: n.text })}>Edit</button>
                <button className="danger" aria-label={`Remove note: ${n.text}`}
                  onClick={act(() => removePinnedNote(n.id))}>Remove</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

registerPanel({ id: "pinned-notes", title: "Pinned notes", component: PinnedNotesPanel });
