import { useCallback, useEffect, useState } from "react";
import * as repo from "../storage";
import type { Campaign } from "../storage";
import { ExportButton, ImportCampaign, UpdateCampaigns } from "./CampaignPortability";
import { getMode } from "../modes/modes";

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
/** "today", "yesterday", "3 days ago", "2 months ago"... */
export function relativeDay(ms: number, now = Date.now()): string {
  const days = Math.round((startOfDay(ms) - startOfDay(now)) / 86_400_000);
  if (days > -30) return rtf.format(days, "day");
  if (days > -365) return rtf.format(Math.round(days / 30), "month");
  return rtf.format(Math.round(days / 365), "year");
}
function startOfDay(ms: number) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }

export default function CampaignPicker({ onOpen }: { onOpen: (c: Campaign) => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!deleting) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDeleting(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleting]);

  const refresh = useCallback(async () => setCampaigns(await repo.listCampaigns()), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = (fn: () => Promise<unknown>) => async () => {
    await fn();
    await refresh();
  };

  return (
    <main className="picker">
      <header className="picker-head">
        <p className="picker-brand">Dungeon Desktop</p>
        <h1>Choose a campaign</h1>
        <p className="muted">Everything stays on this device. Export a campaign to back it up or move it.</p>
      </header>
      <form
        className="row picker-create"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) {
            setNameError(true);
            return;
          }
          setNameError(false);
          void run(() => repo.createCampaign(newName))().then(() => setNewName(""));
        }}
      >
        <input aria-label="New campaign name" placeholder="New campaign name" value={newName} onChange={(e) => { setNewName(e.target.value); setNameError(false); }} aria-invalid={nameError || undefined} />
        <button type="submit" className="primary">Create campaign</button>
      </form>
      {nameError && <p role="alert" className="import-error">Enter a campaign name first.</p>}

      <ImportCampaign onImported={() => void refresh()} />
      <UpdateCampaigns onUpdated={() => void refresh()} />
      {exportError && <p role="alert" className="import-error">{exportError}</p>}

      {campaigns === null ? null : campaigns.length === 0 ? (
        <div className="empty-state picker-empty">
          <p className="muted">No campaigns yet. Create one to begin.</p>
        </div>
      ) : (
        <ul className="campaign-list">
          {campaigns.map((c) => (
            <li key={c.id} aria-label={c.name} className="row">
              {renaming?.id === c.id ? (
                <form
                  className="row grow"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!renaming.name.trim()) return;
                    void run(() => repo.renameCampaign(c.id, renaming.name))().then(() => setRenaming(null));
                  }}
                >
                  <input aria-label="Campaign name" autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: c.id, name: e.target.value })} />
                  <button type="submit" className="primary">Save</button>
                  <button type="button" onClick={() => setRenaming(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <div className="grow campaign-info">
                    <span className="name">{c.name}</span>
                    <span className="campaign-meta muted">
                      Created {relativeDay(c.createdAt)}
                      {getMode(c.lastMode) && <> · last in {getMode(c.lastMode)!.label}</>}
                    </span>
                  </div>
                  <div className="campaign-actions row">
                    <button className="ghost" onClick={() => setRenaming({ id: c.id, name: c.name })}>Rename</button>
                    <button className="ghost" onClick={run(() => repo.duplicateCampaign(c.id))}>Duplicate</button>
                    <ExportButton campaign={c} onError={setExportError} />
                    <button className="ghost danger" onClick={() => setDeleting(c)}>Delete</button>
                    <button className="primary" onClick={() => onOpen(c)}>Open</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) setDeleting(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="del-title" className="dialog">
            <h2 id="del-title">Delete "{deleting.name}"?</h2>
            <p>This permanently removes the campaign and everything in it. It cannot be undone.</p>
            <div className="row end">
              <button autoFocus onClick={() => setDeleting(null)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  const id = deleting.id;
                  setDeleting(null);
                  void run(() => repo.deleteCampaign(id))();
                }}
              >
                Delete campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
