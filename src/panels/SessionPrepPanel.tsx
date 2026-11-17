import { useState, type FormEvent } from "react";
import { registerPanel, type PanelProps } from "./registry";
import {
  carryOverToNextSession, createSession, deleteSession, resolveSession, selectSession, setCurrentSession,
  updateSession, useSelectedSessionId, useSessions, type Session,
} from "../storage/sessions";

function SessionEditor({ campaignId, session }: { campaignId: string; session: Session }) {
  const [title, setTitle] = useState(session.title);
  const [summary, setSummary] = useState(session.summary);
  const [log, setLog] = useState(session.log);
  const [confirming, setConfirming] = useState(false);
  const saveDetails = (e: FormEvent) => {
    e.preventDefault();
    if (title.trim()) void updateSession(session.id, { title: title.trim(), summary });
  };
  return (
    <div className="session-editor">
      <form className="npc-form" onSubmit={saveDetails}>
        <label><span className="muted">Session title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label><span className="muted">Summary</span><textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
        <div className="row end"><button type="submit" className="primary">Save session</button></div>
      </form>
      <div className="row">
        {session.current
          ? <span className="revealed">Current session</span>
          : <button onClick={() => void setCurrentSession(campaignId, session.id)}>Mark as current</button>}
        <button onClick={() => void carryOverToNextSession(campaignId, session.id).then((n) => n && selectSession(campaignId, n.id))}>
          Carry over to next session
        </button>
        <button className="danger" onClick={() => setConfirming(true)}>Delete session</button>
      </div>
      {confirming && (
        <div className="row" role="alert">
          <span>Delete "{session.title}" and its scenes?</span>
          <button className="danger" onClick={() => { setConfirming(false); void deleteSession(session.id); }}>Confirm delete session</button>
          <button onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
      <form className="npc-form" onSubmit={(e) => { e.preventDefault(); void updateSession(session.id, { log }); }}>
        <label><span className="muted">Post-session log</span><textarea rows={4} value={log} onChange={(e) => setLog(e.target.value)} /></label>
        <div className="row end"><button type="submit">Save log</button></div>
      </form>
    </div>
  );
}

function SessionPrepPanel({ campaign }: PanelProps) {
  const sessions = useSessions(campaign.id);
  const selected = useSelectedSessionId(campaign.id);
  const [title, setTitle] = useState("");
  if (!sessions) return <p className="muted">Loading...</p>;
  const active = resolveSession(sessions, selected);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const s = await createSession(campaign.id, { title: title.trim() });
    setTitle("");
    selectSession(campaign.id, s.id);
  };
  return (
    <div className="session-prep">
      <form className="row" onSubmit={add}>
        <input className="grow" aria-label="New session title" placeholder="New session title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit" className="primary">Add session</button>
      </form>
      {sessions.length === 0 ? <p className="muted">No sessions yet. Add one above.</p> : (
        <ul className="npc-items">
          {sessions.map((s) => (
            <li key={s.id}>
              <button className="npc-item" aria-pressed={active?.id === s.id} onClick={() => selectSession(campaign.id, s.id)}>
                <span className="name">{s.title}{s.current ? " (current)" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {active && <SessionEditor key={active.id} campaignId={campaign.id} session={active} />}
    </div>
  );
}

export default registerPanel({ id: "session-prep", title: "Sessions", component: SessionPrepPanel });
