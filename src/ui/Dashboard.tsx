import { useEffect, useState } from "react";
import type { Campaign } from "../storage";
import { setLastMode } from "../storage";
import { DASHBOARD_LAYOUT, DASHBOARD_SHORTCUT, MODES, getMode, type ModeDefinition, type ModeId } from "../modes/modes";
import { useShortcut, useShortcutListener } from "../shortcuts/shortcuts";
import ModeLayout, { PanelFrame } from "./ModeLayout";
import GlobalSearch from "./GlobalSearch";
import ShortcutHelp from "./ShortcutHelp";
import { MainPopoutProvider, usePopout } from "../popout/PopoutContext";
import { selectionIdOf, selectStatBlock } from "../srd/selection";
import { customSelectionId } from "../storage/customEntries";
import { SRD_ATTRIBUTION, SRD_CHANGES } from "../srd/attribution";

/** The Campaign screen: the Dashboard, or one of the Modes, plus the switcher. */
function PopoutBar() {
  const p = usePopout();
  if (!p || (p.popped.size === 0 && !p.blocked)) return null;
  return (
    <div className="row popout-bar" role="status">
      {p.blocked && <span className="import-error">The browser blocked the pop-out window. Allow pop-ups and try again.</span>}
      {p.popped.size > 0 && !p.windowOpen && (
        <>
          <span className="muted">{p.popped.size} panel{p.popped.size === 1 ? "" : "s"} popped out, window closed.</span>
          <button className="primary" onClick={p.reopen}>Reopen pop-out</button>
          <button onClick={p.bringBackAll}>Bring all back</button>
        </>
      )}
    </div>
  );
}

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

/** Opens global search with Ctrl+K (Cmd+K on macOS). */
function SearchShortcuts({ open, help }: { open: () => void; help: () => void }) {
  useShortcut("Shift+?", "Keyboard shortcuts", help);
  useShortcut("?", "Keyboard shortcuts", help);
  useShortcut("Ctrl+K", "Search", open);
  useShortcut("Meta+K", "Search", open);
  return null;
}

/** A search result opened from a Mode that has no Stat Block panel: shown beside the Mode until closed. */
function StatBlockDrawer({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const popout = usePopout();
  if (popout?.popped.has("stat-blocks")) return null;
  return (
    <aside className="stat-drawer" aria-label="Stat Block drawer">
      <button className="panel-ctl" onClick={onClose}>Close Stat Block</button>
      <PanelFrame panelId="stat-blocks" campaign={campaign} />
    </aside>
  );
}

export default function Dashboard({ campaign, onExit }: { campaign: Campaign; onExit: () => void }) {
  const [mode, setMode] = useState<ModeId | null>(null); // null = Dashboard
  const last = getMode(campaign.lastMode);
  const [remembered, setRemembered] = useState(last);
  const current = getMode(mode ?? undefined);
  const [searching, setSearching] = useState(false);
  const [helping, setHelping] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [workspaces, setWorkspaces] = useState<Partial<Record<ModeId, string>>>({});
  const tabs = current?.workspaces;
  const workspace = tabs?.find((w) => w.id === workspaces[current!.id]) ?? tabs?.[0];
  useEffect(() => {
    document.title = `${current ? current.label : "Dashboard"} · ${campaign.name} · Dungeon Desktop`;
    return () => { document.title = "Dungeon Desktop"; };
  }, [current, campaign.name]);
  const layout = workspace ? workspace.layout : current ? current.layout : DASHBOARD_LAYOUT;

  const select = (id: ModeId | null) => {
    setMode(id);
    if (id) {
      setRemembered(getMode(id));
      void setLastMode(campaign.id, id);
    }
  };

  return (
    <MainPopoutProvider campaign={campaign}>
    <div className="shell">
      <ModeShortcuts select={select} />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SearchShortcuts open={() => setSearching(true)} help={() => setHelping(true)} />
      <header className="topbar">
        <button onClick={onExit}>All campaigns</button>
        <span className="campaign-name">{campaign.name}</span>
        <button onClick={() => setSearching(true)} aria-keyshortcuts="Control+K Meta+K" title="Search (Ctrl+K or Cmd+K)">
          Search <kbd>Ctrl K</kbd>
        </button>
        <button onClick={() => select(null)} aria-current={mode === null ? "page" : undefined}>
          Dashboard <kbd>Esc</kbd>
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
              {m.label} <kbd>{m.shortcut}</kbd>
            </button>
          ))}
        </nav>
        <button onClick={() => setHelping(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
      </header>
      <main className="panel-area" id="main-content" tabIndex={-1}>
        <div className="row mode-head">
          <h1>{current ? current.label : "Dashboard"}</h1>
          {!current && remembered && (
            <button className="primary" onClick={() => select(remembered.id)}>
              Continue in {remembered.label}
            </button>
          )}
        </div>
        {current && tabs && (
          <div role="tablist" aria-label={`${current.label} workspaces`} className="row workspace-tabs">
            {tabs.map((w) => (
              <button key={w.id} role="tab" aria-selected={w === workspace}
                onClick={() => setWorkspaces((x) => ({ ...x, [current.id]: w.id }))}>{w.label}</button>
            ))}
          </div>
        )}
        <PopoutBar />
        <ModeLayout layout={layout} campaign={campaign} />
      </main>
      {drawer && !layout.some((pl) => pl.panelId === "stat-blocks") && (
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
    </MainPopoutProvider>
  );
}
