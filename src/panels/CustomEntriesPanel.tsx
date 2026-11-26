import { useRef, useState, type FormEvent } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { selectStatBlock } from "../srd/selection";
import { MonsterEditor } from "./MonsterEditor";
import {
  createCustomEntry, customSelectionId, deleteCustomEntry, emptyData, updateCustomEntry, useCustomEntries,
  type CustomEntry, type CustomKind, type ItemData, type SpellData,
} from "../storage/customEntries";
import { Loading, EmptyState } from "../ui/PanelStates";
import { GUARD } from "../ui/unsaved";
import { PasteDialog, UnreadNotice } from "../paste/PasteDialog";
import { readItem } from "../paste/item";
import { readSpell } from "../paste/spell";
import type { ReadResult } from "../paste/normalize";

const KINDS: CustomKind[] = ["monster", "spell", "item"];
const num = (s: string, fallback: number) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : fallback);

/** Spell and item form state is all strings; converted to the typed data on save. (Monsters use MonsterEditor.) */
type Form = Record<string, string>;
type SimpleKind = "spell" | "item";

function toForm(d: unknown): Form {
  const f: Form = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) if (v !== undefined) f[k] = Array.isArray(v) ? v.join(", ") : String(v);
  return f;
}

function fromForm(kind: SimpleKind, f: Form, base: unknown): unknown {
  if (kind === "spell") {
    const b = base as SpellData;
    return { ...b, level: num(f.level, b.level), school: f.school ?? "", castingTime: f.castingTime ?? "", range: f.range ?? "", components: f.components ?? "", duration: f.duration ?? "", desc: f.desc ?? "",
      classes: (f.classes ?? "").split(",").map((c) => c.trim()).filter(Boolean), ritual: f.ritual === "true", higherLevel: f.higherLevel ?? "" } satisfies SpellData;
  }
  const b = base as ItemData;
  return { ...b, type: f.type ?? "", rarity: f.rarity ?? "", desc: f.desc ?? "", attunement: f.attunement ?? "" } satisfies ItemData;
}

function Field({ label, value, onChange, area, type, autoFocus }: { label: string; value: string; onChange: (v: string) => void; area?: boolean; type?: string; autoFocus?: boolean }) {
  return (
    <label className={area ? "ce-field ce-wide" : "ce-field"}>
      <span>{label}</span>
      {area
        ? <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input autoFocus={autoFocus} type={type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function Editor({ campaignId, kind, entry, onDone }: { campaignId: string; kind: SimpleKind; entry?: CustomEntry; onDone: (id: string | null) => void }) {
  const base = entry?.data ?? emptyData(kind);
  const [name, setName] = useState(entry?.name ?? "");
  const [f, setF] = useState<Form>(() => toForm(base));
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const formRef = useRef<HTMLFormElement>(null);
  const [pasting, setPasting] = useState(false);
  const [unread, setUnread] = useState<string[]>([]);
  /** Replaces only the fields the reader found; Name only when empty. Marks the form unsaved (no input event fires for it). */
  const applyPaste = (r: ReadResult<SpellData | ItemData>) => {
    setF((x) => ({ ...x, ...toForm(r.fields) }));
    if (r.name && !name.trim()) setName(r.name);
    setUnread(r.unread);
    if (formRef.current) formRef.current.dataset.dirty = "true";
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setUnread([]);
    const data = fromForm(kind, f, base) as SpellData | ItemData;
    if (entry) { await updateCustomEntry(entry.id, { name: name.trim(), data }); onDone(entry.id); }
    else onDone((await createCustomEntry(campaignId, kind, name.trim(), data)).id);
  };
  return (
    <>
    <form ref={formRef} {...GUARD} className="ce-form" aria-label={`Custom ${kind} editor`} onSubmit={(e) => void save(e)}>
      <Field label="Name" value={name} onChange={setName} autoFocus />
      <button type="button" onClick={() => setPasting(true)}>Paste stat block</button>
      {kind === "spell" && (
        <>
          <Field label="Level" value={f.level} onChange={set("level")} />
          <Field label="School" value={f.school} onChange={set("school")} />
          <Field label="Casting Time" value={f.castingTime} onChange={set("castingTime")} />
          <Field label="Range" value={f.range} onChange={set("range")} />
          <Field label="Components" value={f.components} onChange={set("components")} />
          <Field label="Duration" value={f.duration} onChange={set("duration")} />
          <Field label="Classes" value={f.classes ?? ""} onChange={set("classes")} />
          <label className="ce-field">
            <span>Ritual</span>
            <input type="checkbox" checked={f.ritual === "true"} onChange={(e) => set("ritual")(String(e.target.checked))} />
          </label>
          <Field label="Description" value={f.desc} onChange={set("desc")} area />
          <Field label="Higher Level" value={f.higherLevel ?? ""} onChange={set("higherLevel")} area />
        </>
      )}
      {kind === "item" && (
        <>
          <Field label="Type" value={f.type} onChange={set("type")} />
          <Field label="Rarity" value={f.rarity} onChange={set("rarity")} />
          <Field label="Attunement" value={f.attunement ?? ""} onChange={set("attunement")} />
          <Field label="Description" value={f.desc} onChange={set("desc")} area />
        </>
      )}
      <div className="row">
        <button type="submit" className="primary">Save</button>
        <button type="button" onClick={() => onDone(null)}>Cancel</button>
        {entry && <button type="button" className="danger" onClick={() => void deleteCustomEntry(entry.id).then(() => { selectStatBlock(campaignId, null); onDone(null); })}>Delete entry</button>}
      </div>
    </form>
    <UnreadNotice lines={unread} />
    {pasting && <PasteDialog read={(kind === "spell" ? readSpell : readItem) as (t: string) => ReadResult<SpellData | ItemData>} onFill={applyPaste} onClose={() => setPasting(false)} />}
    </>
  );
}

function CustomEntriesBody({ campaign }: PanelProps) {
  const entries = useCustomEntries(campaign.id);
  /** `new:<kind>` drafts a new entry; otherwise the id of the entry being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  if (!entries) return <Loading />;
  const editedEntry = editing && !editing.startsWith("new:") ? entries.find((e) => e.id === editing) : undefined;
  const done = (id: string | null) => { if (id) selectStatBlock(campaign.id, customSelectionId(id)); setEditing(null); };
  const kind = editing?.startsWith("new:") ? (editing.slice(4) as CustomKind) : editedEntry?.kind;
  return (
    <div className="custom-entries">
      <div className="row">
        {KINDS.map((k) => <button key={k} className="primary" onClick={() => setEditing(`new:${k}`)}>{`New ${k}`}</button>)}
      </div>
      {kind === "monster" && <MonsterEditor key={editing} campaignId={campaign.id} entry={editedEntry} onDone={done} />}
      {kind && kind !== "monster" && (
        <Editor key={editing} campaignId={campaign.id} kind={kind} entry={editedEntry}
          onDone={done} />
      )}
      {entries.length === 0 ? <EmptyState>No custom entries yet. Create one, or duplicate an SRD creature from its Stat Block.</EmptyState> : (
        <ul className="npc-items">
          {entries.map((e) => (
            <li key={e.id}>
              <button className="npc-item" aria-pressed={editing === e.id}
                onClick={() => { setEditing(e.id); selectStatBlock(campaign.id, customSelectionId(e.id)); }}>
                <span className="name">{e.name}</span>
                <span className="muted">Custom {e.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default registerPanel({ id: "custom-entries", title: "Custom Entries", component: CustomEntriesBody });
