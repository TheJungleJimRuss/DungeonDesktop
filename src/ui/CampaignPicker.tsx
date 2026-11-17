import { useCallback, useEffect, useState } from "react";
import * as repo from "../storage";
import type { Campaign } from "../storage";
import { ExportButton, ImportCampaign } from "./CampaignPortability";

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
      <h1>Choose a campaign</h1>
      <form
        className="row"
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
      {exportError && <p role="alert" className="import-error">{exportError}</p>}

      {campaigns === null ? null : campaigns.length === 0 ? (
        <p className="muted">No campaigns yet. Create one to begin.</p>
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
                  <span className="grow name">{c.name}</span>
                  <button className="primary" onClick={() => onOpen(c)}>Open</button>
                  <button onClick={() => setRenaming({ id: c.id, name: c.name })}>Rename</button>
                  <button onClick={run(() => repo.duplicateCampaign(c.id))}>Duplicate</button>
                  <ExportButton campaign={c} onError={setExportError} />
                  <button className="danger" onClick={() => setDeleting(c)}>Delete</button>
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
