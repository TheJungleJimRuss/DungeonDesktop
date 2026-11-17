import { registerPanel, type PanelProps } from "./registry";
import { sessionRemaining, useSessions } from "../storage/sessions";

function SessionSummaryPanel({ campaign }: PanelProps) {
  const sessions = useSessions(campaign.id);
  if (!sessions) return <p className="muted">Loading...</p>;
  const current = sessions.find((s) => s.current);
  if (!current) return <p className="muted">Nothing here yet. No current session: create one in Prep mode.</p>;
  const left = sessionRemaining(current);
  return (
    <div className="session-summary">
      <h3>{current.title}</h3>
      {current.summary.trim() ? <p className="location-notes">{current.summary}</p> : <p className="muted">No summary.</p>}
      <ul className="npc-items">
        <li>Unplayed scenes: {left.unplayedScenes}</li>
        <li>Unticked secrets and clues: {left.unticked}</li>
      </ul>
    </div>
  );
}

export default registerPanel({ id: "session-summary", title: "Session summary", component: SessionSummaryPanel });
