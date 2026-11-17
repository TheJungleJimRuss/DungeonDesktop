import { useId, type ReactNode } from "react";
import "../panels/NpcListPanel";
import "../panels/NameGeneratorPanel";
import "../panels/LocationListPanel";
import "../panels/WorldMapPanel";
import "../panels/BattleMapPanel";
import "../panels/RoutePanel";
import "../panels/PassivePerceptionPanel";
import "../panels/PinnedNotesPanel";
import "../panels/ScratchNotesPanel";
import "../panels/PlayerCardPanel";
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
import type { PanelPlacement } from "../modes/modes";
import type { Campaign } from "../storage";

/** Frame around one panel. `data-panel-id` identifies the panel. */
export function PanelFrame({ panelId, campaign, placement, controls }: { panelId: string; campaign: Campaign; placement?: PanelPlacement; controls?: ReactNode }) {
  const def = getPanel(panelId);
  const titleId = useId();
  const Body = def.component;
  const style = placement && {
    gridColumn: `${placement.col} / span ${placement.colSpan}`,
    gridRow: `${placement.row} / span ${placement.rowSpan}`,
  };
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
        {controls}
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
