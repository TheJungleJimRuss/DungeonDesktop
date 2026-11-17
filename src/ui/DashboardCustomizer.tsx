import { useId } from "react";
import { listPanels, getPanel } from "../panels/registry";
import { DASHBOARD_NEW_H, DASHBOARD_NEW_W } from "../modes/dashboardLayout";
import { setDashboard, type DashboardEntry } from "../storage/dashboard";

/** Edits the Dashboard of one Campaign; `entries` is what is shown now. */
export function useDashboardEditing(campaignId: string, entries: DashboardEntry[]) {
  const save = (next: DashboardEntry[]) => void setDashboard(campaignId, next);
  return {
    /** Saves the positions the grid settled on after a drag or resize. */
    saveLayout: (next: DashboardEntry[]) => save(next),
    remove: (panelId: string) => save(entries.filter((e) => e.panelId !== panelId)),
    /** Appends at the bottom, half width (60) and 48 high. */
    add: (panelId: string) => save([...entries, { panelId, x: 0, y: Math.max(0, ...entries.map((e) => e.y + e.h)), w: DASHBOARD_NEW_W, h: DASHBOARD_NEW_H }]),
    reset: () => void setDashboard(campaignId, null),
  };
}

type Editing = ReturnType<typeof useDashboardEditing>;

/** What a panel's title bar shows while customizing: the drag hint and "Remove". */
export function PanelEditBar({ panelId, editing }: { panelId: string; editing: Editing }) {
  const title = getPanel(panelId).title;
  return (
    <div className="panel-edit-bar row">
      <span className="panel-grip" aria-hidden="true" title="Drag to move">::::</span>
      <button className="panel-ctl" aria-label={`Remove ${title}`} onClick={() => editing.remove(panelId)}>Remove</button>
    </div>
  );
}

/** "Add panel" picker and "Reset to default", shown above the grid while customizing. */
export function DashboardToolbar({ entries, editing }: { entries: DashboardEntry[]; editing: Editing }) {
  const id = useId();
  const options = listPanels().filter((p) => !p.notOnDashboard && !entries.some((e) => e.panelId === p.id));
  return (
    <div className="row dashboard-toolbar">
      <label htmlFor={id}>Add panel</label>
      <select id={id} value="" onChange={(e) => e.target.value && editing.add(e.target.value)}>
        <option value="">Choose a panel...</option>
        {options.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <button onClick={editing.reset}>Reset to default</button>
    </div>
  );
}
