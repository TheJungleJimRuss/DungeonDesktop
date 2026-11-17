import { useEffect, useState } from "react";
import type { Campaign } from "../storage";
import { setLastMode } from "../storage";
import { DASHBOARD_SHORTCUT, MODES, getMode, type ModeDefinition, type ModeId, type PanelPlacement } from "../modes/modes";
import { useShortcut, useShortcutListener } from "../shortcuts/shortcuts";
import ModeLayout, { PanelFrame } from "./ModeLayout";
import { EmptyState, ModeSwitchContext } from "./PanelStates";
import GlobalSearch from "./GlobalSearch";
import { useDashboard } from "../storage/dashboard";
import { DashboardToolbar, useDashboardEditing } from "./DashboardCustomizer";
import DashboardGrid from "./DashboardGrid";
import QuickAdd from "./QuickAdd";
import ShortcutHelp from "./ShortcutHelp";
import { selectionIdOf, selectStatBlock } from "../srd/selection";
import { customSelectionId } from "../storage/customEntries";
import { SRD_ATTRIBUTION, SRD_CHANGES } from "../srd/attribution";

/** Registers Esc and one switch shortcut per Mode with the central shortcut layer. */
function ModeShortcuts({ select }: { select: (id: ModeId | null) => void }) {
  useShortcutListener();
  useShortcut(DASHBOARD_SHORTCUT, "Dashboard", () => select(null));
  return <>{MODES.map((m) => <ModeShortcut key={m.id} mode={m} select={select} />)}</>;
}

function ModeShortcut({ mode, select }: { mode: ModeDefinition; select: (id: ModeId | null) => void }) {
  useShortcut(mode.shortcut, mode.label, () => select(mode.id));
  return null;
}

export const STAT_BLOCKS_SHORTCUT = "Alt+S";

/** Opens global search with Ctrl+K (Cmd+K on macOS). */
function SearchShortcuts({ open, help, statBlocks }: { open: () => void; help: () => void; statBlocks: () => void }) {
  useShortcut(STAT_BLOCKS_SHORTCUT, "Show or hide Stat Blocks", statBlocks);
  useShortcut("Shift+?", "Keyboard shortcuts", help);
  useShortcut("?", "Keyboard shortcuts", help);
  useShortcut("Ctrl+K", "Search", open);
  useShortcut("Meta+K", "Search", open);
  return null;
}

/** The Stat Blocks panel, floating over the rest of the screen until toggled off (navbar button or Close). */
function StatBlockDrawer({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  return (
    <aside className="stat-drawer" aria-label="Stat Block drawer">
      <button className="panel-ctl" onClick={onClose}>Close Stat Block</button>
      <PanelFrame panelId="stat-blocks" campaign={campaign} />
    </aside>
  );
}

const placementOf = (e: { panelId: string }): PanelPlacement => ({ panelId: e.panelId, col: 1, colSpan: 1, row: 1, rowSpan: 1 });

/** The Campaign screen: the Dashboard, or one of the Modes, plus the switcher. */
export default function Dashboard({ campaign, onExit }: { campaign: Campaign; onExit: () => void }) {
  const [mode, setMode] = useState<ModeId | null>(null); // null = Dashboard
  const last = getMode(campaign.lastMode);
  const [remembered, setRemembered] = useState(last);
  const current = getMode(mode ?? undefined);
  const [searching, setSearching] = useState(false);
  const [helping, setHelping] = useState(false);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    document.title = `${current ? current.label : "Dashboard"} · ${campaign.name} · Dungeon Desktop`;
    return () => { document.title = "Dungeon Desktop"; };
  }, [current, campaign.name]);
  const [customizing, setCustomizing] = useState(false);
  const entries = useDashboard(campaign);
  const editing = useDashboardEditing(campaign.id, entries);
  const onDashboard = !current;
  const layout = current ? current.layout : entries.map(placementOf);

  const select = (id: ModeId | null) => {
    setMode(id);
    setCustomizing(false); // leaving (or re-entering) the Dashboard ends customizing
    if (id) {
      setRemembered(getMode(id));
      void setLastMode(campaign.id, id);
    }
  };

  return (
    <div className="shell">
      <ModeShortcuts select={select} />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SearchShortcuts open={() => setSearching(true)} help={() => setHelping(true)} statBlocks={() => setDrawer((d) => !d)} />
      <header className="topbar">
        <button onClick={onExit}>All campaigns</button>
        <span className="campaign-name">{campaign.name}</span>
        <button onClick={() => setSearching(true)} aria-keyshortcuts="Control+K Meta+K" title="Search (Ctrl+K or Cmd+K)">
          Search
        </button>
        <QuickAdd campaign={campaign} />
        <button onClick={() => select(null)} aria-current={mode === null ? "page" : undefined}>
          Dashboard
        </button>
        <button className="stat-toggle" onClick={() => setDrawer((d) => !d)} aria-pressed={drawer} aria-keyshortcuts={STAT_BLOCKS_SHORTCUT} title={`Show or hide Stat Blocks (${STAT_BLOCKS_SHORTCUT})`}>
          Stat Blocks
        </button>
        <nav aria-label="Modes" className="mode-nav">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => select(m.id)}
              aria-current={mode === m.id ? "page" : undefined}
              aria-keyshortcuts={m.shortcut}
              title={`${m.label} (${m.shortcut})`}
            >
              {m.label}
            </button>
          ))}
        </nav>
        <button onClick={() => setHelping(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
      </header>
      <ModeSwitchContext.Provider value={select}>
      <main className="panel-area" id="main-content" tabIndex={-1}>
        <div className="row mode-head">
          <h1>{current ? current.label : "Dashboard"}</h1>
          {!current && remembered && (
            <button className="primary" onClick={() => select(remembered.id)}>
              Continue in {remembered.label}
            </button>
          )}
          {onDashboard && (
            <button onClick={() => setCustomizing((c) => !c)}>{customizing ? "Done" : "Customize Dashboard"}</button>
          )}
        </div>
        {onDashboard && customizing && <DashboardToolbar entries={entries} editing={editing} />}
        {onDashboard
          ? <DashboardGrid entries={entries} campaign={campaign} editing={customizing ? editing : undefined} />
          : <ModeLayout layout={layout} campaign={campaign} />}
        {onDashboard && entries.length === 0 && (
          <EmptyState action={!customizing && <button className="primary" onClick={() => setCustomizing(true)}>Choose panels</button>}>
            Your Dashboard is empty. Customize it, then use "Add panel" to choose what to show.
          </EmptyState>
        )}
      </main>
      </ModeSwitchContext.Provider>
      {drawer && (
        <StatBlockDrawer campaign={campaign} onClose={() => setDrawer(false)} />
      )}
      {helping && <ShortcutHelp onClose={() => setHelping(false)} />}
      {searching && (
        <GlobalSearch campaignId={campaign.id} onClose={() => setSearching(false)}
          onOpenCustom={(c) => { selectStatBlock(campaign.id, customSelectionId(c.id)); setDrawer(true); setSearching(false); }}
          onOpen={(h) => { selectStatBlock(campaign.id, selectionIdOf(h)); setDrawer(true); setSearching(false); }} />
      )}
      <footer className="srd-attribution muted">{SRD_ATTRIBUTION} {SRD_CHANGES}</footer>
    </div>
  );
}
