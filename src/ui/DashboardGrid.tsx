import { useMemo, useRef } from "react";
import ReactGridLayout, { useContainerWidth, type Compactor, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import type { Campaign } from "../storage";
import type { DashboardEntry } from "../storage/dashboard";
import { DASHBOARD_COLUMNS, DASHBOARD_MIN_H, DASHBOARD_MIN_W, settleAround } from "../modes/dashboardLayout";
import { PanelFrame } from "./ModeLayout";
import { PanelEditBar, type useDashboardEditing } from "./DashboardCustomizer";

// Interactive things inside a title bar never start a drag.
const NO_DRAG = "button, a, input, select, textarea, [role=button]";

const toEntry = (l: Layout[number]) => ({ panelId: l.i, x: l.x, y: l.y, w: l.w, h: l.h });

/** The grid's collision rule. The library only places the panel being dragged or resized (overlap allowed); this then
 *  lays out the rest from where they were when the gesture began, so panels pushed out of the way come back once
 *  nothing covers their spot. Outside a gesture it changes nothing: no compaction, gaps stay. */
function useSettlingCompactor() {
  const gesture = useRef<{ id: string; start: ReturnType<typeof toEntry>[] } | null>(null);
  const compactor = useMemo<Compactor>(() => ({
    type: null,
    allowOverlap: true,
    compact(layout) {
      const g = gesture.current;
      const moved = g && layout.find((l) => l.i === g.id);
      if (!g || !moved) return layout.map((l) => ({ ...l }));
      const settled = new Map(settleAround(g.start, toEntry(moved)).map((e) => [e.panelId, e]));
      return layout.map((l) => ({ ...l, x: settled.get(l.i)?.x ?? l.x, y: settled.get(l.i)?.y ?? l.y }));
    },
  }), []);
  const begin = (start: Layout, item: Layout[number] | null) => {
    gesture.current = item ? { id: item.i, start: start.map(toEntry) } : null;
  };
  const end = () => { gesture.current = null; };
  return { compactor, begin, end };
}

/** The Dashboard: panels on a fine grid (120 columns, 8 px rows, no snapping feel, no compaction; pushed panels return during a drag). Static, unless `editing` is given: then panels drag by their
 *  title bar, resize from the bottom-right corner, and positions are saved when a drag or resize stops. */
export default function DashboardGrid({ entries, campaign, editing }: {
  entries: DashboardEntry[]; campaign: Campaign; editing?: ReturnType<typeof useDashboardEditing>;
}) {
  const { width, containerRef } = useContainerWidth({ measureBeforeMount: true }); // no 1280px first frame
  const layout = entries.map((e) => ({ i: e.panelId, x: e.x, y: e.y, w: e.w, h: e.h, minW: DASHBOARD_MIN_W, minH: DASHBOARD_MIN_H }));
  const { compactor, begin, end } = useSettlingCompactor();
  const save = (next: Layout) =>
    editing?.saveLayout(next.map((l) => ({ panelId: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
  return (
    <div ref={containerRef} className={`dashboard-grid${editing ? " customizing" : ""}`}>
      <ReactGridLayout
        width={width}
        layout={layout}
        gridConfig={{ cols: DASHBOARD_COLUMNS, rowHeight: 8, margin: [0, 0], containerPadding: [0, 0] }}
        dragConfig={{ enabled: !!editing, handle: ".panel-head", cancel: NO_DRAG }}
        resizeConfig={{ enabled: !!editing, handles: editing ? ["se"] : [] }}
        compactor={compactor}
        onDragStart={(start, item) => begin(start, item)}
        onResizeStart={(start, item) => begin(start, item)}
        onDragStop={(next) => { end(); save(next); }}
        onResizeStop={(next) => { end(); save(next); }}
      >
        {entries.map((e) => (
          <div key={e.panelId} className="dashboard-cell">
            <PanelFrame panelId={e.panelId} campaign={campaign}
              controls={editing && <PanelEditBar panelId={e.panelId} editing={editing} />} />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
}
