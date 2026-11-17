import { useEffect, useMemo, useRef, useState } from "react";
import { crLabel, loadMonsters, type Monster } from "./monsters";
import { buildIndex, search } from "./search";
import { customSelectionId, useCustomEntries } from "../storage/customEntries";

interface Choice { id: string; name: string; custom: boolean; cr?: number }

/** Search dialog to choose a monster Stat Block (SRD or custom) by id. Reused for NPC links. */
export default function StatBlockPicker({ campaignId, onPick, onClose }: { campaignId: string; onPick: (id: string) => void; onClose: () => void }) {
  const customs = useCustomEntries(campaignId);
  const [srd, setSrd] = useState<Monster[]>([]);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { void loadMonsters().then(setSrd); input.current?.focus(); }, []);
  const index = useMemo(() => buildIndex<Choice>([
    ...(customs ?? []).filter((c) => c.kind === "monster").map((c) => ({ id: customSelectionId(c.id), name: c.name, custom: true })),
    ...srd.map((m) => ({ id: m.id, name: m.name, custom: false, cr: m.cr })),
  ]), [customs, srd]);
  const results = useMemo(() => search(index, query, 10), [index, query]);
  return (
    <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Link Stat Block"
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}>
        <input ref={input} type="search" aria-label="Search Stat Blocks" placeholder="Search creatures…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {query.trim() && results.length === 0 && <p className="muted">No matches.</p>}
        <ul className="search-results" aria-label="Stat Block results">
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => onPick(r.id)}>
                <strong>{r.name}</strong> <span className="muted">{r.custom ? "Custom monster" : `CR ${crLabel(r.cr ?? 0)}`}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="row end"><button onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}
