import { useState, type FormEvent } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { selectStatBlock } from "../srd/selection";
import type { Entry } from "../srd/monsters";
import {
  createCustomEntry, customSelectionId, deleteCustomEntry, emptyData, updateCustomEntry, useCustomEntries,
  type CustomEntry, type CustomKind, type ItemData, type MonsterData, type SpellData,
} from "../storage/customEntries";
import { Loading, EmptyState } from "../ui/PanelStates";
import { GUARD } from "../ui/unsaved";

const KINDS: CustomKind[] = ["monster", "spell", "item"];
const NUMBER_FIELDS = [["AC", "ac"], ["HP", "hp"], ["CR", "cr"], ["XP", "xp"], ["Proficiency bonus", "pb"]] as const;
const TEXT_FIELDS = [["Size", "size"], ["Type", "type"], ["Alignment", "alignment"], ["HP dice", "hpRoll"], ["Speed", "speed"], ["Senses", "senses"], ["Languages", "languages"]] as const;
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
const LISTS = [["Saving Throws", "saves"], ["Skills", "skills"], ["Damage Vulnerabilities", "vulnerabilities"], ["Damage Resistances", "resistances"], ["Damage Immunities", "immunities"], ["Condition Immunities", "conditionImmunities"]] as const;
const SECTIONS = [["Traits", "traits"], ["Actions", "actions"], ["Bonus Actions", "bonusActions"], ["Reactions", "reactions"], ["Legendary Actions", "legendaryActions"]] as const;

/** One "Name: description" per line. */
const entriesToText = (es: Entry[]) => es.map((e) => `${e.name}: ${e.desc}`).join("\n");
const textToEntries = (t: string): Entry[] =>
  t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(":");
    return i < 0 ? { name: l, desc: "" } : { name: l.slice(0, i).trim(), desc: l.slice(i + 1).trim() };
  });
const listToText = (xs: string[]) => xs.join(", ");
const textToList = (t: string) => t.split(",").map((x) => x.trim()).filter(Boolean);
const num = (s: string, fallback: number) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : fallback);

/** Form state is all strings; converted to the typed data on save. */
type Form = Record<string, string>;

function toForm(kind: CustomKind, d: unknown): Form {
  const f: Form = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>)) {
    if (k === "abilities") for (const a of ABILITIES) f[a] = String((v as Record<string, number>)[a]);
    else if (Array.isArray(v)) f[k] = v.length && typeof v[0] === "object" ? entriesToText(v as Entry[]) : listToText(v as string[]);
    else if (v !== undefined) f[k] = String(v);
  }
  if (kind === "monster") for (const [, k] of [...LISTS, ...SECTIONS]) f[k] ??= "";
  return f;
}

function fromForm(kind: CustomKind, f: Form, base: unknown): unknown {
  if (kind === "monster") {
    const b = base as MonsterData;
    const d: MonsterData = { ...b };
    for (const [, k] of TEXT_FIELDS) d[k] = f[k] ?? "";
    for (const [, k] of NUMBER_FIELDS) d[k] = num(f[k], b[k]);
    d.abilities = Object.fromEntries(ABILITIES.map((a) => [a, num(f[a], b.abilities[a])])) as MonsterData["abilities"];
    for (const [, k] of LISTS) d[k] = textToList(f[k] ?? "");
    for (const [, k] of SECTIONS) d[k] = textToEntries(f[k] ?? "");
    return d;
  }
  if (kind === "spell") {
    const b = base as SpellData;
    return { ...b, level: num(f.level, b.level), school: f.school ?? "", castingTime: f.castingTime ?? "", range: f.range ?? "", components: f.components ?? "", duration: f.duration ?? "", desc: f.desc ?? "" } satisfies SpellData;
  }
  const b = base as ItemData;
  return { ...b, type: f.type ?? "", rarity: f.rarity ?? "", desc: f.desc ?? "" } satisfies ItemData;
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

function Editor({ campaignId, kind, entry, onDone }: { campaignId: string; kind: CustomKind; entry?: CustomEntry; onDone: (id: string | null) => void }) {
  const base = entry?.data ?? emptyData(kind);
  const [name, setName] = useState(entry?.name ?? "");
  const [f, setF] = useState<Form>(() => toForm(kind, base));
  const set = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data = fromForm(kind, f, base) as MonsterData | SpellData | ItemData;
    if (entry) { await updateCustomEntry(entry.id, { name: name.trim(), data }); onDone(entry.id); }
    else onDone((await createCustomEntry(campaignId, kind, name.trim(), data)).id);
  };
  return (
    <form {...GUARD} className="ce-form" aria-label={`Custom ${kind} editor`} onSubmit={(e) => void save(e)}>
      <Field label="Name" value={name} onChange={setName} autoFocus />
      {kind === "monster" && (
        <>
          {TEXT_FIELDS.map(([l, k]) => <Field key={k} label={l} value={f[k]} onChange={set(k)} />)}
          {NUMBER_FIELDS.map(([l, k]) => <Field key={k} label={l} value={f[k]} onChange={set(k)} />)}
          <div className="ce-abilities">
            {ABILITIES.map((a) => <Field key={a} label={a.toUpperCase()} value={f[a]} onChange={set(a)} />)}
          </div>
          {LISTS.map(([l, k]) => <Field key={k} label={l} value={f[k]} onChange={set(k)} />)}
          <p className="muted">Traits and actions: one per line, written Name: description. Lists: separate with commas.</p>
          {SECTIONS.map(([l, k]) => <Field key={k} label={l} value={f[k]} onChange={set(k)} area />)}
        </>
      )}
      {kind === "spell" && (
        <>
          <Field label="Level" value={f.level} onChange={set("level")} />
          <Field label="School" value={f.school} onChange={set("school")} />
          <Field label="Casting Time" value={f.castingTime} onChange={set("castingTime")} />
          <Field label="Range" value={f.range} onChange={set("range")} />
          <Field label="Components" value={f.components} onChange={set("components")} />
          <Field label="Duration" value={f.duration} onChange={set("duration")} />
          <Field label="Description" value={f.desc} onChange={set("desc")} area />
        </>
      )}
      {kind === "item" && (
        <>
          <Field label="Type" value={f.type} onChange={set("type")} />
          <Field label="Rarity" value={f.rarity} onChange={set("rarity")} />
          <Field label="Description" value={f.desc} onChange={set("desc")} area />
        </>
      )}
      <div className="row">
        <button type="submit" className="primary">Save</button>
        <button type="button" onClick={() => onDone(null)}>Cancel</button>
        {entry && <button type="button" className="danger" onClick={() => void deleteCustomEntry(entry.id).then(() => { selectStatBlock(campaignId, null); onDone(null); })}>Delete entry</button>}
      </div>
    </form>
  );
}

function CustomEntriesBody({ campaign }: PanelProps) {
  const entries = useCustomEntries(campaign.id);
  /** `new:<kind>` drafts a new entry; otherwise the id of the entry being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  if (!entries) return <Loading />;
  const editedEntry = editing && !editing.startsWith("new:") ? entries.find((e) => e.id === editing) : undefined;
  const kind = editing?.startsWith("new:") ? (editing.slice(4) as CustomKind) : editedEntry?.kind;
  return (
    <div className="custom-entries">
      <div className="row">
        {KINDS.map((k) => <button key={k} className="primary" onClick={() => setEditing(`new:${k}`)}>{`New ${k}`}</button>)}
      </div>
      {kind && (
        <Editor key={editing} campaignId={campaign.id} kind={kind} entry={editedEntry}
          onDone={(id) => { if (id) selectStatBlock(campaign.id, customSelectionId(id)); setEditing(null); }} />
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
