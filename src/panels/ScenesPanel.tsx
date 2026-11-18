import { useRef, useState, type FormEvent } from "react";
import { registerPanel, type PanelProps } from "./registry";
import {
  addScene, deleteScene, emptySceneDraft, moveScene, newItem, resolveSession, setScenePlayed, tickItem,
  updateScene, useSelectedSessionId, useSessions, type Scene, type SceneItem,
} from "../storage/sessions";
import { useLocations, type Location } from "../storage/locations";
import { useNpcs, type Npc } from "../storage/npcs";
import { useScratchNotes } from "../storage/notes";
import { Loading, EmptyState } from "../ui/PanelStates";
import { GUARD } from "../ui/unsaved";

function ItemsEditor({ label, items, onChange }: { label: string; items: SceneItem[]; onChange: (i: SceneItem[]) => void }) {
  const [text, setText] = useState("");
  const add = () => { if (text.trim()) { onChange([...items, newItem(text.trim())]); setText(""); } };
  return (
    <fieldset>
      <legend>{label}</legend>
      <ul className="npc-secrets">
        {items.map((it) => (
          <li key={it.id} className="row">
            <input className="grow" aria-label={`${label} text`} value={it.text}
              onChange={(e) => onChange(items.map((x) => (x.id === it.id ? { ...x, text: e.target.value } : x)))} />
            <button type="button" aria-label={`Remove ${label} ${it.text}`} onClick={() => onChange(items.filter((x) => x.id !== it.id))}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="row">
        <input className="grow" aria-label={`New ${label}`} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add}>{`Add ${label}`}</button>
      </div>
    </fieldset>
  );
}

function SceneForm({ scene, locations, npcs, onSave, onCancel }: {
  scene: Scene; locations: Location[]; npcs: Npc[]; onSave: (s: Scene) => void; onCancel: () => void;
}) {
  const [d, setD] = useState(scene);
  const submit = (e: FormEvent) => { e.preventDefault(); if (d.title.trim()) onSave({ ...d, title: d.title.trim() }); };
  const set = <K extends keyof Scene>(k: K, v: Scene[K]) => setD((x) => ({ ...x, [k]: v }));
  const missingLoc = d.locationId && !locations.some((l) => l.id === d.locationId);
  return (
    <form {...GUARD} className="npc-form" onSubmit={submit}>
      <label><span className="muted">Scene title</span><input autoFocus value={d.title} onChange={(e) => set("title", e.target.value)} /></label>
      <label><span className="muted">Goal</span><input value={d.goal} onChange={(e) => set("goal", e.target.value)} /></label>
      <label><span className="muted">Notes</span><textarea rows={3} value={d.notes} onChange={(e) => set("notes", e.target.value)} /></label>
      <ItemsEditor label="Secret" items={d.secrets} onChange={(i) => set("secrets", i)} />
      <ItemsEditor label="Clue" items={d.clues} onChange={(i) => set("clues", i)} />
      <label><span className="muted">Scene location</span>
        <select value={d.locationId ?? ""} onChange={(e) => set("locationId", e.target.value || undefined)}>
          <option value="">No location</option>
          {missingLoc && <option value={d.locationId}>Deleted location</option>}
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>Scene NPCs</legend>
        {npcs.length === 0 && <p className="muted">No NPCs in this Campaign.</p>}
        {npcs.map((n) => (
          <label key={n.id} className="row">
            <input type="checkbox" checked={d.npcIds.includes(n.id)}
              onChange={(e) => set("npcIds", e.target.checked ? [...d.npcIds, n.id] : d.npcIds.filter((x) => x !== n.id))} />
            <span>{n.name || "Unnamed"}</span>
          </label>
        ))}
      </fieldset>
      <div className="row end">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary">Save scene</button>
      </div>
    </form>
  );
}

function ScenesPanel({ campaign }: PanelProps) {
  const sessions = useSessions(campaign.id);
  const locations = useLocations(campaign.id);
  const npcs = useNpcs(campaign.id);
  const selected = useSelectedSessionId(campaign.id);
  const scratch = useScratchNotes(campaign.id) ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);

  if (!sessions || !locations || !npcs) return <Loading />;
  const session = resolveSession(sessions, selected);
  if (!session) return <p className="muted">Create a session to plan scenes.</p>;
  const locName = (id?: string) => (id ? locations.find((l) => l.id === id)?.name ?? "Deleted location" : null);
  const npcName = (id: string) => npcs.find((n) => n.id === id)?.name || (npcs.some((n) => n.id === id) ? "Unnamed" : "Deleted NPC");

  return (
    <div className="scenes">
      <div className="row">
        <h3 className="grow">{session.title}</h3>
        <button className="primary" onClick={() => { setAdding(true); setEditing(null); }}>Add scene</button>
      </div>
      {adding && (
        <SceneForm scene={{ ...emptySceneDraft(), id: "new", played: false }} locations={locations} npcs={npcs}
          onCancel={() => setAdding(false)}
          onSave={(s) => { const { id: _i, played: _p, ...draft } = s; void addScene(session.id, draft).then(() => setAdding(false)); }} />
      )}
      {session.scenes.length === 0 && !adding && <EmptyState>No scenes yet.</EmptyState>}
      <ol className="scene-items">
        {session.scenes.map((sc, i) => {
          const loc = locName(sc.locationId);
          return (
            <li key={sc.id} className="scene" data-played={sc.played || undefined} draggable
              onDragStart={(e) => { dragFrom.current = i; e.dataTransfer?.setData?.("text/plain", sc.id); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom.current !== null) void moveScene(session.id, dragFrom.current, i);
                dragFrom.current = null;
              }}>
              {editing === sc.id ? (
                <SceneForm scene={sc} locations={locations} npcs={npcs} onCancel={() => setEditing(null)}
                  onSave={(s) => { const { id: _i, ...patch } = s; void updateScene(session.id, sc.id, patch).then(() => setEditing(null)); }} />
              ) : (
                <article aria-label={`Scene ${sc.title}`}>
                  <div className="row">
                    <span className="drag-handle" aria-hidden="true" title="Drag to reorder">⠿</span>
                    <h4 className="grow">{sc.title}</h4>
                    <label className="row"><input type="checkbox" checked={sc.played}
                      onChange={(e) => void setScenePlayed(session.id, sc.id, e.target.checked)} />
                      <span>{`Played ${sc.title}`}</span></label>
                  </div>
                  {sc.goal && <p><strong>Goal:</strong> {sc.goal}</p>}
                  {sc.notes && <p className="location-notes">{sc.notes}</p>}
                  {([["Secrets", "secrets", sc.secrets], ["Clues", "clues", sc.clues]] as const).map(([label, kind, items]) =>
                    items.length > 0 && (
                      <div key={kind}>
                        <h5>{label}</h5>
                        <ul className="npc-secrets">
                          {items.map((it) => (
                            <li key={it.id}>
                              <label className="row">
                                <input type="checkbox" checked={it.done}
                                  onChange={(e) => void tickItem(session.id, sc.id, kind, it.id, e.target.checked)} />
                                <span className={it.done ? "revealed" : undefined}>{it.text}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  {loc && <p>Location: <span className={loc === "Deleted location" ? "muted" : undefined}>{loc}</span></p>}
                  {sc.npcIds.length > 0 && (
                    <p>NPCs: {sc.npcIds.map((id, k) => (
                      <span key={id} className={npcs.some((n) => n.id === id) ? undefined : "muted"}>{k > 0 ? ", " : ""}{npcName(id)}</span>
                    ))}</p>
                  )}
                  {scratch.some((n) => n.sceneId === sc.id) && (
                    <div>
                      <h5>Scratch notes</h5>
                      <ul className="note-list">
                        {scratch.filter((n) => n.sceneId === sc.id).map((n) => <li key={n.id}>{n.text}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="row">
                    <button aria-label={`Move ${sc.title} up`} disabled={i === 0} onClick={() => void moveScene(session.id, i, i - 1)}>Up</button>
                    <button aria-label={`Move ${sc.title} down`} disabled={i === session.scenes.length - 1} onClick={() => void moveScene(session.id, i, i + 1)}>Down</button>
                    <button aria-label={`Edit ${sc.title}`} onClick={() => { setEditing(sc.id); setAdding(false); }}>Edit</button>
                    {confirming === sc.id ? (
                      <>
                        <button className="danger" aria-label={`Confirm delete ${sc.title}`} onClick={() => { setConfirming(null); void deleteScene(session.id, sc.id); }}>Confirm delete</button>
                        <button onClick={() => setConfirming(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="danger" aria-label={`Delete ${sc.title}`} onClick={() => setConfirming(sc.id)}>Delete</button>
                    )}
                  </div>
                </article>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default registerPanel({ id: "scenes", title: "Scenes", component: ScenesPanel });
