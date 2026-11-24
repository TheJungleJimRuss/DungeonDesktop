import { useId, useState } from "react";
import { buildAttackPresets, findAttackPresets, type AttackPreset } from "../party/attackPresets";
import type { Attack } from "../party/sheet";
import { loadReference } from "../srd/reference";

/** Type to find an SRD weapon or damaging spell; picking one fills the New attack fields. Data loads on first focus. */
export default function AttackSearch({ onPick, label = "Search weapons and spells" }: { onPick: (a: Attack) => void; label?: string }) {
  const [q, setQ] = useState("");
  const [presets, setPresets] = useState<AttackPreset[] | null>(null);
  const [hi, setHi] = useState(0);
  const listId = useId();
  const load = () => { if (!presets) void loadReference().then((r) => setPresets(buildAttackPresets(r))); };
  const hits = presets ? findAttackPresets(presets, q) : [];
  const pick = (p: AttackPreset) => { onPick(p.attack); setQ(""); setHi(0); };
  return (
    <div className="attack-search">
      <label>{label}
        <input type="search" value={q} placeholder="e.g. Longsword, Fire Bolt" autoComplete="off"
          role="combobox" aria-expanded={hits.length > 0} aria-controls={listId} aria-autocomplete="list"
          onFocus={load} onChange={(e) => { load(); setQ(e.target.value); setHi(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && hits.length) { e.preventDefault(); setHi((hi + 1) % hits.length); }
            else if (e.key === "ArrowUp" && hits.length) { e.preventDefault(); setHi((hi - 1 + hits.length) % hits.length); }
            else if (e.key === "Enter") { e.preventDefault(); if (hits[hi]) pick(hits[hi]); }
          }} />
      </label>
      {q.trim() && presets && (hits.length ? (
        <ul id={listId} role="listbox" aria-label="Weapon and spell matches" className="attack-search-list">
          {hits.map((p, i) => (
            <li key={`${p.kind}-${p.id}`} role="option" aria-selected={i === hi} onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseEnter={() => setHi(i)}>
              <span className="attack-search-name">{p.name}</span>
              <span className="muted">{p.kind === "weapon" ? "Weapon" : "Spell"} · {p.detail}</span>
            </li>
          ))}
        </ul>
      ) : <small className="muted">No weapon or damaging spell matches — type the attack by hand below.</small>)}
    </div>
  );
}
