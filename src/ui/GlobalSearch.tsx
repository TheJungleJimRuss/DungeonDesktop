import { useEffect, useMemo, useRef, useState } from "react";
import { crLabel } from "../srd/monsters";
import { monsterFilterOptions, loadSearchData, REF_TYPES, searchReference, spellLevelLabel, type RefHit, type RefType, type SearchData } from "../srd/reference";
import { buildIndex, search } from "../srd/search";
import { listCustomEntries, type CustomEntry } from "../storage/customEntries";
import { Loading } from "./PanelStates";

/** Global search dialog. Results are grouped by type (only Monsters so far). Enter or click opens the result. */
export default function GlobalSearch({ campaignId, onOpen, onOpenCustom, onClose }: {
  campaignId?: string; onOpen: (hit: RefHit) => void; onOpenCustom?: (entry: CustomEntry) => void; onClose: () => void;
}) {
  const [customs, setCustoms] = useState<CustomEntry[]>([]);
  useEffect(() => { if (campaignId) void listCustomEntries(campaignId).then(setCustoms); }, [campaignId]);
  const [data, setData] = useState<SearchData | null>(null);
  const [type, setType] = useState<RefType | undefined>();
  const [cr, setCr] = useState<number | undefined>();
  const [creatureType, setCreatureType] = useState("");
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { loadSearchData().then(setData, () => setError(true)); }, []);
  useEffect(() => { input.current?.focus(); }, []);
  const options = useMemo(() => (data ? monsterFilterOptions(data.monsters) : null), [data]);
  const monsterFilters = type === "monster";
  const results = useMemo(
    () => (data ? searchReference(data, query, { type, cr: monsterFilters ? cr : undefined, creatureType: monsterFilters && creatureType ? creatureType : undefined }) : []),
    [data, query, type, cr, creatureType, monsterFilters]);
  const customResults = useMemo(() => search(buildIndex(customs), query), [customs, query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && (customResults[0] || results[active])) {
      e.preventDefault();
      if (results[active]) onOpen(results[active]); else if (customResults[0]) onOpenCustom?.(customResults[0]);
    }
  };

  return (
    <div className="search-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog search-dialog" role="dialog" aria-modal="true" aria-label="Global search" onKeyDown={onKeyDown}>
        <input ref={input} type="search" aria-label="Search" placeholder="Search monsters, spells, items, conditions…" value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }} />
        {error && <p className="import-error">The SRD data could not be loaded.</p>}
        {!error && !data && <Loading label="Loading SRD data…" lines={4} />}
        {data && (query.trim() || (monsterFilters && (cr !== undefined || creatureType))) && results.length === 0 && customResults.length === 0 && <p className="muted">No matches.</p>}
        <div className="search-filters" role="group" aria-label="Filter by type">
          {[{ type: undefined, label: "All" }, ...REF_TYPES].map((t) => (
            <button key={t.label} aria-pressed={type === t.type} className={type === t.type ? "active" : undefined}
              onClick={() => { setType(t.type); setActive(0); }}>{t.label}</button>
          ))}
        </div>
        {monsterFilters && options && (
          <div className="search-filters">
            <label>Challenge rating{" "}
              <select value={cr ?? ""} onChange={(e) => { setCr(e.target.value === "" ? undefined : Number(e.target.value)); setActive(0); }}>
                <option value="">Any</option>
                {options.crs.map((c) => <option key={c} value={c}>{crLabel(c)}</option>)}
              </select>
            </label>
            <label>Creature type{" "}
              <select value={creatureType} onChange={(e) => { setCreatureType(e.target.value); setActive(0); }}>
                <option value="">Any</option>
                {options.types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        )}
        {REF_TYPES.map((g) => {
          const rows = results.map((hit, i) => ({ hit, i })).filter((r) => r.hit.type === g.type);
          return rows.length > 0 && (
            <div key={g.type}>
              <h3 className="search-group">{g.label}</h3>
              <ul className="search-results" aria-label={g.label}>
                {rows.map(({ hit, i }) => (
                  <li key={hit.entry.id}>
                    <button className={i === active ? "active" : undefined} aria-current={i === active ? "true" : undefined}
                      onMouseEnter={() => setActive(i)} onClick={() => onOpen(hit)}>
                      <strong>{hit.entry.name}</strong> <span className="muted">{hitSummary(hit)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {customResults.length > 0 && (
          <div>
            <h3 className="search-group">Custom</h3>
            <ul className="search-results" aria-label="Custom">
              {customResults.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onOpenCustom?.(c)}>
                    <strong>{c.name}</strong> <span className="muted search-custom">Custom {c.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="muted search-hint"><kbd>↑</kbd><kbd>↓</kbd> choose <kbd>Enter</kbd> open <kbd>Esc</kbd> close</p>
      </div>
    </div>
  );
}

function hitSummary(hit: RefHit): string {
  switch (hit.type) {
    case "monster": return `CR ${crLabel(hit.entry.cr)} · ${hit.entry.size} ${hit.entry.type}`;
    case "spell": return spellLevelLabel(hit.entry);
    case "magic-item": return [hit.entry.category, hit.entry.rarity].filter(Boolean).join(" · ");
    case "equipment": return hit.entry.categories[0] ?? "";
    case "condition": return "Condition";
  }
}
