import { useState, type FormEvent } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { useNpcs } from "../storage/npcs";
import { useSelectedNpcId } from "../storage/npcs";
import { useSessions, type Session } from "../storage/sessions";
import {
  addScratchNote, removeScratchNote, updateScratchNote, useScratchNotes, type ScratchAttachment,
} from "../storage/notes";
import { Loading, EmptyState } from "../ui/PanelStates";

const sceneKey = (sessionId?: string, sceneId?: string) => (sessionId && sceneId ? `${sessionId}|${sceneId}` : "");
const parseScene = (v: string): Pick<ScratchAttachment, "sessionId" | "sceneId"> => {
  const [sessionId, sceneId] = v.split("|");
  return v ? { sessionId, sceneId } : {};
};

function Attach({ npcs, sessions, npcId, scene, onNpc, onScene }: {
  npcs: { id: string; name: string }[]; sessions: Session[]; npcId: string; scene: string;
  onNpc: (v: string) => void; onScene: (v: string) => void;
}) {
  return (
    <>
      <label className="row"><span className="muted">NPC</span>
        <select aria-label="Attach to NPC" value={npcId} onChange={(e) => onNpc(e.target.value)}>
          <option value="">No NPC</option>
          {npcs.map((n) => <option key={n.id} value={n.id}>{n.name || "Unnamed"}</option>)}
        </select>
      </label>
      <label className="row"><span className="muted">Scene</span>
        <select aria-label="Attach to scene" value={scene} onChange={(e) => onScene(e.target.value)}>
          <option value="">No scene</option>
          {sessions.flatMap((s) => s.scenes.map((sc) => (
            <option key={sc.id} value={sceneKey(s.id, sc.id)}>{`${s.title}: ${sc.title}`}</option>
          )))}
        </select>
      </label>
    </>
  );
}

function ScratchNotesPanel({ campaign }: PanelProps) {
  const notes = useScratchNotes(campaign.id);
  const npcs = useNpcs(campaign.id);
  const sessions = useSessions(campaign.id);
  const selected = useSelectedNpcId(campaign.id);
  const [draft, setDraft] = useState("");
  // undefined = follow the NPC selected on the card
  const [npcChoice, setNpcChoice] = useState<string>();
  const [sceneChoice, setSceneChoice] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string; npcId: string; scene: string } | null>(null);

  if (!notes || !npcs || !sessions) return <Loading />;
  const npcExists = (id?: string) => !!id && npcs.some((n) => n.id === id);
  const defaultNpc = npcExists(selected ?? undefined) ? selected! : "";
  const npcId = npcChoice ?? defaultNpc;
  const attach = (n: string, scene: string): ScratchAttachment => ({ ...(n ? { npcId: n } : {}), ...parseScene(scene) });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    await addScratchNote(campaign.id, draft, attach(npcId, sceneChoice));
    setDraft("");
    setNpcChoice(undefined);
    setSceneChoice("");
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (editing.text.trim()) await updateScratchNote(editing.id, editing.text, attach(editing.npcId, editing.scene));
    setEditing(null);
  };
  const npcName = (id: string) => npcs.find((n) => n.id === id)?.name || "Unnamed";
  const sceneName = (sessionId?: string, sceneId?: string) => {
    const s = sessions.find((x) => x.id === sessionId);
    const sc = s?.scenes.find((x) => x.id === sceneId);
    return s && sc ? `${s.title}: ${sc.title}` : null;
  };

  return (
    <div className="pinned-notes">
      <form className="npc-form" onSubmit={add}>
        <textarea rows={2} aria-label="New scratch note" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="row">
          <Attach npcs={npcs} sessions={sessions} npcId={npcId} scene={sceneChoice} onNpc={setNpcChoice} onScene={setSceneChoice} />
          <button className="primary" type="submit">Add scratch note</button>
        </div>
      </form>
      {notes.length === 0 && <EmptyState>No scratch notes yet.</EmptyState>}
      <ul className="note-list">
        {notes.map((n) => {
          const scene = sceneName(n.sessionId, n.sceneId);
          return (
            <li key={n.id}>
              {editing?.id === n.id ? (
                <form className="npc-form" onSubmit={save}>
                  <textarea rows={2} aria-label="Edit scratch note" autoFocus value={editing.text}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
                  <div className="row">
                    <Attach npcs={npcs} sessions={sessions} npcId={editing.npcId} scene={editing.scene}
                      onNpc={(v) => setEditing({ ...editing, npcId: v })} onScene={(v) => setEditing({ ...editing, scene: v })} />
                    <button type="submit" className="primary">Save scratch note</button>
                    <button type="button" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="row">
                  <div className="grow">
                    <span data-note-text>{n.text}</span>
                    {(npcExists(n.npcId) || scene) && (
                      <div className="muted">{[npcExists(n.npcId) && `NPC: ${npcName(n.npcId!)}`, scene && `Scene: ${scene}`].filter(Boolean).join(" · ")}</div>
                    )}
                  </div>
                  <button aria-label={`Edit scratch note: ${n.text}`}
                    onClick={() => setEditing({ id: n.id, text: n.text, npcId: npcExists(n.npcId) ? n.npcId! : "", scene: scene ? sceneKey(n.sessionId, n.sceneId) : "" })}>Edit</button>
                  <button className="danger" aria-label={`Delete scratch note: ${n.text}`}
                    onClick={() => void removeScratchNote(n.id)}>Delete</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default registerPanel({ id: "scratch-notes", title: "Scratch notes", component: ScratchNotesPanel });
