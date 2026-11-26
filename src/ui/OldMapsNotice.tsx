import { useEffect, useState, type ReactNode } from "react";
import { exportOldMapCampaigns, hasOldMaps } from "../storage/oldMaps";

const fileName = (name: string) => `${name.trim().replace(/[^\w\-]+/g, "-").replace(/^-+|-+$/g, "") || "campaign"}.dungeon.json`;

/** Holds the app back (so the database is not upgraded yet) while this device has old Maps: the upgrade deletes them (spec 0009, ADR 0003).
 *  Shown once: it never appears again after Continue, because the upgrade then clears them. */
export default function OldMapsNotice({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "notice" | "go">("checking");
  const [exported, setExported] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void hasOldMaps().then((old) => setState(old ? "notice" : "go"), () => setState("go")); }, []);

  if (state === "checking") return null;
  if (state === "go") return <>{children}</>;
  const save = async () => {
    setError("");
    try {
      for (const data of await exportOldMapCampaigns()) {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url; a.download = fileName(data.campaign.name);
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }
      setExported(true);
    } catch { setError("Could not export. Your Maps have not been deleted yet."); }
  };
  return (
    <div className="old-maps-notice" role="dialog" aria-modal="true" aria-label="Old Maps will be deleted">
      <p><strong>Maps have changed, and your existing Maps will be deleted.</strong> A Map is now one endless canvas with a fixed 5 ft square, so old Maps (their drawings and Tokens) cannot be converted.
        Your Locations, NPCs, Encounters, Party and notes are kept. Export your Campaigns first if you want a copy.</p>
      <div className="row">
        <button type="button" onClick={() => void save()}>Export Campaigns</button>
        <button type="button" className="primary" onClick={() => setState("go")}>Continue and delete old Maps</button>
      </div>
      {exported && <p role="status">Exported. Old Maps are still included in those files, but importing them skips the Maps.</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
