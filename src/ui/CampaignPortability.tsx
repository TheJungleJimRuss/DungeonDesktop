import { useRef, useState } from "react";
import * as repo from "../storage";
import type { Campaign, CampaignExport } from "../storage";

const fileName = (name: string) => `${name.trim().replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "") || "campaign"}.dungeon.json`;

export function ExportButton({ campaign, onError }: { campaign: Campaign; onError: (msg: string) => void }) {
  return (
    <button
      className="ghost"
      aria-label={`Export ${campaign.name}`}
      onClick={async () => {
        const data = await repo.exportCampaign(campaign.id);
        if (!data) return onError(`"${campaign.name}" no longer exists, so it cannot be exported.`);
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName(campaign.name);
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }}
    >
      Export
    </button>
  );
}

export function ImportCampaign({ onImported }: { onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [pending, setPending] = useState<{ data: CampaignExport; existingName: string } | null>(null);

  const finish = async (data: CampaignExport) => {
    try {
      await repo.importCampaign(data);
      setMessage({ kind: "ok", text: `Imported "${data.campaign.name}".` });
      onImported();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Import failed." });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    const result = repo.parseCampaignFile(await file.text());
    if (!result.ok) return setMessage({ kind: "error", text: result.error });
    const existing = await repo.getCampaign(result.data.campaign.id);
    if (existing) setPending({ data: result.data, existingName: existing.name });
    else await finish(result.data);
  };

  return (
    <div className="import">
      <button onClick={() => input.current?.click()}>Import campaign</button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        aria-label="Import campaign file"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          await onFile(file);
        }}
      />
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "import-error" : "muted"}>
          {message.text}
        </p>
      )}
      {pending && (
        <div className="backdrop">
          <div role="dialog" aria-modal="true" aria-labelledby="ow-title" className="dialog">
            <h2 id="ow-title">Overwrite "{pending.existingName}"?</h2>
            <p>
              A campaign with the same id already exists. Importing "{pending.data.campaign.name}" replaces it and
              everything in it with the contents of the file. This cannot be undone.
            </p>
            <div className="row end">
              <button onClick={() => setPending(null)}>Cancel</button>
              <button
                className="danger"
                onClick={() => {
                  const data = pending.data;
                  setPending(null);
                  void finish(data);
                }}
              >
                Overwrite campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
