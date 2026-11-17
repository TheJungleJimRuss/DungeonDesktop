import { useId } from "react";
import "../panels/placeholders";
import "../panels/NpcListPanel";
import "../panels/NpcCardPanel";
import "../panels/NameGeneratorPanel";
import "../panels/PinnedNpcPanel";
import "../panels/LocationListPanel";
import "../panels/LocationViewPanel";
import "../panels/WorldMapPanel";
import "../panels/BattleMapPanel";
import "../panels/RoutePanel";
import "../panels/PassivePerceptionPanel";
import "../panels/PinnedNotesPanel";
import "../panels/ScratchNotesPanel";
import "../panels/PartyPanel";
import "../panels/CharacterSheetsPanel";
import "../panels/SessionPrepPanel";
import "../panels/SessionSummaryPanel";
import "../panels/ScenesPanel";
import "../panels/StatBlockPanel";
import "../panels/CombatantStatBlockPanel";
import "../panels/CustomEntriesPanel";
import "../panels/DiceRollerPanel";
import "../panels/InitiativeTrackerPanel";
import { getPanel } from "../panels/registry";
import { usePopout } from "../popout/PopoutContext";
import type { PanelPlacement } from "../modes/modes";
import type { Campaign } from "../storage";

/** Frame around one panel. `data-panel-id` is the handle a Pop-out Window will use. */
export function PanelFrame({ panelId, campaign, placement }: { panelId: string; campaign: Campaign; placement?: PanelPlacement }) {
  const def = getPanel(panelId);
  const titleId = useId();
  const Body = def.component;
  const popout = usePopout();
  const style = placement && {
    gridColumn: `${placement.col} / span ${placement.colSpan}`,
    gridRow: `${placement.row} / span ${placement.rowSpan}`,
  };
  if (popout?.role === "main" && popout.popped.has(def.id)) {
    return (
      <section className="panel panel-popped" data-panel-id={def.id} data-popped style={style}>
        <p className="muted">{def.title}: popped out</p>
        <button onClick={() => popout.bringBack(def.id)} title={`Bring back ${def.title}`}>
          Popped out — bring back
        </button>
      </section>
    );
  }
  return (
    <section
      className="panel"
      role="region"
      aria-labelledby={titleId}
      data-panel-id={def.id}
      style={style}
    >
      <div className="panel-head">
        <h2 id={titleId} className="panel-title">{def.title}</h2>
        {popout?.role === "main" && (
          <button className="panel-ctl" aria-label={`Pop out ${def.title}`} title="Send to Pop-out Window"
            onClick={() => popout.popOut(def.id)}>Pop out ↗</button>
        )}
        {popout?.role === "popout" && (
          <button className="panel-ctl" aria-label={`Bring back ${def.title}`} title="Return to main window"
            onClick={() => popout.bringBack(def.id)}>Bring back</button>
        )}
      </div>
      <div className="panel-body"><Body campaign={campaign} /></div>
    </section>
  );
}

/** Arranges panels on a dense 12-column desktop grid. */
export default function ModeLayout({ layout, campaign }: { layout: PanelPlacement[]; campaign: Campaign }) {
  return (
    <div className="mode-grid">
      {layout.map((pl) => (
        <PanelFrame key={pl.panelId} panelId={pl.panelId} campaign={campaign} placement={pl} />
      ))}
    </div>
  );
}
