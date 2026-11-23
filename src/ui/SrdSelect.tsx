import { useState } from "react";
import { matchSrd } from "../srd/match";

const CUSTOM = "__custom";

/** Dropdown of SRD entries plus "Custom…" (which reveals a text box). `entries` undefined = still loading: a plain text box, so nothing is lost. */
export default function SrdSelect({ label, entries, text, id, onChange }: {
  label: string; entries: { id: string; name: string }[] | undefined; text: string | undefined; id: string | undefined;
  onChange: (text: string, id: string | undefined) => void;
}) {
  const [custom, setCustom] = useState(false);
  const value = text ?? "";
  if (!entries) return <label>{label}<input value={value} onChange={(e) => onChange(e.target.value, undefined)} /></label>;
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const hit = custom ? undefined : (id ? sorted.find((e) => e.id === id) : undefined) ?? matchSrd(value, sorted);
  const selected = hit ? hit.id : custom || value.trim() ? CUSTOM : "";
  return (
    <>
      <label>{label}
        <select value={selected} onChange={(e) => {
          const pick = e.target.value;
          if (pick === CUSTOM) { setCustom(true); onChange("", undefined); return; }
          setCustom(false);
          const entry = sorted.find((x) => x.id === pick);
          onChange(entry?.name ?? "", entry?.id);
        }}>
          <option value="">—</option>
          {sorted.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          <option value={CUSTOM}>Custom…</option>
        </select>
      </label>
      {selected === CUSTOM && (
        <label>Custom {label.toLowerCase()}<input value={value} onChange={(e) => onChange(e.target.value, undefined)} /></label>
      )}
    </>
  );
}
