import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { selectStatBlock } from "../srd/selection";
import type { Entry } from "../srd/monsters";
import {
  CONDITIONS, CR_OPTIONS, CR_XP, LANGUAGE_SUGGESTIONS, MONSTER_TYPES, SIZES, abilityMod, autoSaveBonus, autoSkillBonus,
  attackText, attackToHit, crToPb, fromMonsterForm, passivePerception, signed, splitDefenses, toMonsterForm, type AbilityScores, type AttackSpec,
  type DamageSpec, type MonsterForm,
} from "../srd/monsterForm";
import { DAMAGE_TYPES } from "../combat/damageTypes";
import { ABILITIES, SKILLS, type AbilityKey } from "../party/sheet";
import { createCustomEntry, deleteCustomEntry, emptyMonsterData, updateCustomEntry, type CustomEntry, type MonsterData } from "../storage/customEntries";
import { GUARD } from "../ui/unsaved";
import { PasteDialog, UnreadNotice } from "../paste/PasteDialog";
import { readMonster } from "../paste/monster";
import type { ReadResult } from "../paste/normalize";

const crLabel = (cr: number) => (cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr));
const ABBR = (a: AbilityKey) => a.toUpperCase();
const move = <T,>(xs: T[], i: number, d: -1 | 1): T[] => {
  const j = i + d;
  if (j < 0 || j >= xs.length) return xs;
  const out = [...xs];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

/** Number input that keeps a text draft while typing, so clearing the field does not snap back to a number. */
function Num({ label, value, onChange, nullable, disabled, className }: {
  label: string; value: number | null; onChange: (n: number | null) => void; nullable?: boolean; disabled?: boolean; className?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input type="number" aria-label={label} className={className} disabled={disabled} value={text ?? (value === null ? "" : String(value))}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (v.trim() === "") { if (nullable) onChange(null); }
        else if (Number.isFinite(Number(v))) onChange(Number(v));
      }}
      onBlur={() => setText(null)} />
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={wide ? "ce-field ce-wide" : "ce-field"}><span>{label}</span>{children}</label>;
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return <fieldset className={`ce-set ${className ?? ""}`}><legend>{title}</legend>{children}</fieldset>;
}

/** One trait / action / ...: name, description and the move / remove buttons. `children` is the slot for the attack builder. */
export function EntryCard({ noun, index, count, entry, onChange, onMove, onRemove, children }: {
  noun: string; index: number; count: number; entry: Entry; onChange: (e: Entry) => void; onMove: (d: -1 | 1) => void; onRemove: () => void; children?: ReactNode;
}) {
  const id = `${noun} ${index + 1}`;
  return (
    <li className="ce-entry">
      <input aria-label={`${id} name`} placeholder="Name" value={entry.name} onChange={(e) => onChange({ ...entry, name: e.target.value })} />
      <textarea aria-label={`${id} description`} rows={3} placeholder="Description" value={entry.desc} onChange={(e) => onChange({ ...entry, desc: e.target.value })} />
      {children}
      <div className="ce-entry-buttons">
        <button type="button" aria-label={`Move ${id} up`} disabled={index === 0} onClick={() => onMove(-1)}>Move up</button>
        <button type="button" aria-label={`Move ${id} down`} disabled={index === count - 1} onClick={() => onMove(1)}>Move down</button>
        <button type="button" aria-label={`Remove ${id}`} onClick={onRemove}>Remove</button>
      </div>
    </li>
  );
}

const ENTRY_SECTIONS = [
  ["Traits", "traits", "Trait", "Add trait"],
  ["Actions", "actions", "Action", "Add action"],
  ["Bonus Actions", "bonusActions", "Bonus action", "Add bonus action"],
  ["Reactions", "reactions", "Reaction", "Add reaction"],
  ["Legendary Actions", "legendaryActions", "Legendary action", "Add legendary action"],
] as const;

/** Add-a-row control: a text box with suggestions and an Add button (Enter adds too). */
function AddRow({ label, buttonLabel, list, onAdd }: { label: string; buttonLabel: string; list?: string; onAdd: (v: string) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => { if (draft.trim()) { onAdd(draft.trim()); setDraft(""); } };
  return (
    <div className="ce-add">
      <input aria-label={label} list={list} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button type="button" aria-label={buttonLabel} onClick={add}>Add</button>
    </div>
  );
}

/** Checkbox per standard name, plus the other (qualified) entries as removable rows. */
function DefenseGroup({ title, standard, list, onChange }: { title: string; standard: readonly string[]; list: string[]; onChange: (l: string[]) => void }) {
  const { checked, other } = splitDefenses(list, standard);
  const lower = title.toLowerCase();
  return (
    <fieldset className="ce-sub">
      <legend>{title}</legend>
      <div className="ce-checks">
        {standard.map((t) => (
          <label key={t} className="ce-check">
            <input type="checkbox" aria-label={`${title}: ${t}`} checked={checked.includes(t)}
              onChange={(e) => onChange([...(e.target.checked ? [...checked, t] : checked.filter((c) => c !== t)), ...other])} />
            <span aria-hidden="true">{t}</span>
          </label>
        ))}
      </div>
      {other.length > 0 && (
        <ul className="ce-chips">
          {other.map((o, i) => (
            <li key={`${o}-${i}`}>
              <span>{o}</span>
              <button type="button" aria-label={`Remove ${lower} ${o}`} onClick={() => onChange([...checked, ...other.filter((_, j) => j !== i)])}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <AddRow label={`Other ${lower}`} buttonLabel={`Add other ${lower}`} onAdd={(v) => onChange([...checked, ...other, v])} />
    </fieldset>
  );
}

/** An editable bonus that shows the automatic value until the DM types their own; "Auto" goes back. */
function BonusInput({ label, override, auto, onChange }: { label: string; override: number | null; auto: number; onChange: (n: number | null) => void }) {
  return (
    <span className="ce-bonus">
      <Num label={label} value={override ?? auto} onChange={(n) => { if (n !== null) onChange(n); }} />
      {override !== null && <button type="button" className="ce-auto" aria-label={`Reset ${label} to auto`} onClick={() => onChange(null)}>Auto</button>}
    </span>
  );
}

interface DamageDraft { count: number; die: number; bonus: number | null; type: string }
const DICE = [4, 6, 8, 10, 12, 20] as const;

/** One damage line: dice count, die, bonus (auto = ability mod when `autoBonus` is given) and type. */
function DamageRow({ prefix, id, draft, autoBonus, onChange, onRemove }: {
  prefix: string; id: string; draft: DamageDraft; autoBonus: number; onChange: (d: DamageDraft) => void; onRemove?: () => void;
}) {
  return (
    <div className="ce-dmg">
      <Num label={`${prefix} count for ${id}`} className="ce-dmg-count" value={draft.count} onChange={(n) => n !== null && onChange({ ...draft, count: Math.max(1, Math.floor(n)) })} />
      <select aria-label={`${prefix} die for ${id}`} value={draft.die} onChange={(e) => onChange({ ...draft, die: Number(e.target.value) })}>
        {DICE.map((d) => <option key={d} value={d}>d{d}</option>)}
      </select>
      <BonusInput label={`${prefix} bonus for ${id}`} override={draft.bonus} auto={autoBonus} onChange={(bonus) => onChange({ ...draft, bonus })} />
      <select aria-label={`${prefix} type for ${id}`} value={draft.type} onChange={(e) => onChange({ ...draft, type: e.target.value })}>
        {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {onRemove && <button type="button" aria-label={`Remove extra damage for ${id}`} onClick={onRemove}>Remove</button>}
    </div>
  );
}

/** "Build attack" helper for an action-type card. Local state only; "Write description" replaces the description text. */
function AttackBuilder({ id, abilities, pb, onWrite }: { id: string; abilities: AbilityScores; pb: number; onWrite: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<AttackSpec["kind"]>("melee");
  const [abilityPick, setAbilityPick] = useState<"str" | "dex" | null>(null);
  const [proficient, setProficient] = useState(true);
  const [toHitOverride, setToHitOverride] = useState<number | null>(null);
  const [reach, setReach] = useState(5);
  const [range, setRange] = useState({ normal: 80, long: 320 });
  const [main, setMain] = useState<DamageDraft>({ count: 1, die: 6, bonus: null, type: "Slashing" });
  const [extra, setExtra] = useState<DamageDraft | null>(null);

  if (!open) {
    return <button type="button" className="ce-build" aria-expanded="false" aria-label={`Build attack for ${id}`} onClick={() => setOpen(true)}>Build attack</button>;
  }

  const strMod = abilityMod(abilities.str), dexMod = abilityMod(abilities.dex);
  const autoAbility: "str" | "dex" = kind === "melee" ? "str" : kind === "ranged" ? "dex" : dexMod > strMod ? "dex" : "str";
  const ability = abilityPick ?? autoAbility;
  const mod = ability === "str" ? strMod : dexMod;
  const autoHit = attackToHit(mod, pb, proficient);
  const toHit = toHitOverride ?? autoHit;
  const pickKind = (k: AttackSpec["kind"]) => {
    setKind(k);
    setAbilityPick(null);
    if (k === "both") setRange({ normal: 20, long: 60 }); else if (k === "ranged") setRange({ normal: 80, long: 320 });
  };
  const spec: AttackSpec = {
    kind, toHit,
    ...(kind !== "ranged" ? { reach } : {}),
    ...(kind !== "melee" ? { range: { normal: range.normal, long: range.long > 0 ? range.long : undefined } } : {}),
    damage: [main, ...(extra ? [extra] : [])].map((d, i): DamageSpec => ({ count: d.count, die: d.die, bonus: d.bonus ?? (i === 0 ? mod : 0), type: d.type })),
  };
  const text = attackText(spec);

  return (
    <fieldset className="ce-builder">
      <legend>
        <button type="button" className="ce-build" aria-expanded="true" aria-label={`Build attack for ${id}`} onClick={() => setOpen(false)}>Build attack</button>
      </legend>
      <div className="ce-grid">
        <Field label="Kind">
          <select aria-label={`Attack kind for ${id}`} value={kind} onChange={(e) => pickKind(e.target.value as AttackSpec["kind"])}>
            <option value="melee">Melee</option>
            <option value="ranged">Ranged</option>
            <option value="both">Melee or Ranged</option>
          </select>
        </Field>
        <Field label="Ability">
          <select aria-label={`Attack ability for ${id}`} value={ability} onChange={(e) => setAbilityPick(e.target.value as "str" | "dex")}>
            <option value="str">STR</option>
            <option value="dex">DEX</option>
          </select>
        </Field>
        <label className="ce-check ce-check-field">
          <input type="checkbox" aria-label={`Proficient for ${id}`} checked={proficient} onChange={(e) => setProficient(e.target.checked)} />
          <span aria-hidden="true">Proficient</span>
        </label>
        <div className="ce-field">
          <span>To hit</span>
          <BonusInput label={`To hit for ${id}`} override={toHitOverride} auto={autoHit} onChange={setToHitOverride} />
        </div>
        {kind !== "ranged" && (
          <Field label="Reach (ft.)"><Num label={`Reach for ${id}`} value={reach} onChange={(n) => n !== null && setReach(n)} /></Field>
        )}
        {kind !== "melee" && (
          <>
            <Field label="Range (ft.)"><Num label={`Range for ${id}`} value={range.normal} onChange={(n) => n !== null && setRange({ ...range, normal: n })} /></Field>
            <Field label="Long range (ft.)"><Num label={`Long range for ${id}`} value={range.long} onChange={(n) => n !== null && setRange({ ...range, long: n })} /></Field>
          </>
        )}
      </div>
      <div className="ce-dmg-block">
        <span className="ce-dmg-title">Damage</span>
        <DamageRow prefix="Damage" id={id} draft={main} autoBonus={mod} onChange={setMain} />
        {extra ? (
          <>
            <span className="ce-dmg-title">Extra damage</span>
            <DamageRow prefix="Extra damage" id={id} draft={extra} autoBonus={0} onChange={setExtra} onRemove={() => setExtra(null)} />
          </>
        ) : (
          <button type="button" aria-label={`Add extra damage for ${id}`} onClick={() => setExtra({ count: 1, die: 6, bonus: null, type: "Fire" })}>Add extra damage</button>
        )}
      </div>
      <output className="ce-preview" aria-label={`Attack preview for ${id}`}>{text}</output>
      <button type="button" aria-label={`Write description for ${id}`} onClick={() => { onWrite(text); setOpen(false); }}>Write description</button>
    </fieldset>
  );
}

export function MonsterEditor({ campaignId, entry, onDone }: { campaignId: string; entry?: CustomEntry; onDone: (id: string | null) => void }) {
  const base = (entry?.data as MonsterData | undefined) ?? emptyMonsterData();
  const [name, setName] = useState(entry?.name ?? "");
  const [f, setF] = useState<MonsterForm>(() => toMonsterForm(base, entry?.name ?? ""));
  const [skillToAdd, setSkillToAdd] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [pasting, setPasting] = useState(false);
  const [unread, setUnread] = useState<string[]>([]);
  const ids = useId();
  const patch = (p: Partial<MonsterForm>) => setF((x) => ({ ...x, ...p }));
  const speed = (p: Partial<MonsterForm["speed"]>) => setF((x) => ({ ...x, speed: { ...x.speed, ...p } }));
  const senses = (p: Partial<MonsterForm["senses"]>) => setF((x) => ({ ...x, senses: { ...x.senses, ...p } }));

  /** Replaces only the fields the reader found; Name only when empty. Marks the form unsaved (no input event fires for it). */
  const applyPaste = (r: ReadResult<MonsterData>) => {
    const merged: MonsterData = { ...fromMonsterForm(f, base), ...r.fields };
    setF({ ...toMonsterForm(merged, name), legendaryUses: r.fields.legendaryUses ?? f.legendaryUses });
    if (r.name && !name.trim()) setName(r.name);
    setUnread(r.unread);
    if (formRef.current) formRef.current.dataset.dirty = "true";
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setUnread([]);
    const data = fromMonsterForm(f, base);
    if (entry) { await updateCustomEntry(entry.id, { name: name.trim(), data }); onDone(entry.id); }
    else onDone((await createCustomEntry(campaignId, "monster", name.trim(), data)).id);
  };

  const sizes = SIZES.includes(f.size as (typeof SIZES)[number]) ? [...SIZES] : [...SIZES, f.size];
  const crs = CR_OPTIONS.includes(f.cr) ? CR_OPTIONS : [...CR_OPTIONS, f.cr].sort((a, b) => a - b);
  const computedPassive = passivePerception(f.abilities, f.skills, f.pb);
  const availableSkills = SKILLS.filter((s) => !f.skills.some((r) => r.key === s.key));
  const pickedSkill = availableSkills.some((s) => s.key === skillToAdd) ? skillToAdd : (availableSkills[0]?.key ?? "");

  return (
    <>
    <form ref={formRef} {...GUARD} className="ce-form ce-monster" aria-label="Custom monster editor" onSubmit={(e) => void save(e)}>
      <Section title="Basics">
        <button type="button" onClick={() => setPasting(true)}>Paste stat block</button>
        <div className="ce-grid">
          <Field label="Name" wide><input autoFocus aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Size">
            <select aria-label="Size" value={f.size} onChange={(e) => patch({ size: e.target.value })}>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <input aria-label="Type" list={`${ids}-types`} value={f.type} onChange={(e) => patch({ type: e.target.value })} />
          </Field>
          <Field label="Alignment">
            <input aria-label="Alignment" list={`${ids}-align`} value={f.alignment} onChange={(e) => patch({ alignment: e.target.value })} />
          </Field>
        </div>
        <datalist id={`${ids}-types`}>{MONSTER_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        <datalist id={`${ids}-align`}>
          {["unaligned", "lawful good", "neutral good", "chaotic good", "lawful neutral", "neutral", "chaotic neutral", "lawful evil", "neutral evil", "chaotic evil", "any alignment"].map((a) => <option key={a} value={a} />)}
        </datalist>
      </Section>

      <Section title="Challenge">
        <div className="ce-grid">
          <Field label="CR">
            <select aria-label="CR" value={String(f.cr)} onChange={(e) => { const cr = Number(e.target.value); patch({ cr, xp: CR_XP[cr] ?? f.xp, pb: crToPb(cr) }); }}>
              {crs.map((c) => <option key={c} value={String(c)}>{crLabel(c)}</option>)}
            </select>
          </Field>
          <Field label="XP"><Num label="XP" value={f.xp} onChange={(n) => n !== null && patch({ xp: n })} /></Field>
          <Field label="XP in lair"><Num label="XP in lair" nullable value={f.xpInLair} onChange={(n) => patch({ xpInLair: n })} /></Field>
          <Field label="Proficiency bonus"><Num label="Proficiency bonus" value={f.pb} onChange={(n) => n !== null && patch({ pb: n })} /></Field>
        </div>
      </Section>

      <Section title="Combat">
        <div className="ce-grid">
          <Field label="AC"><Num label="AC" value={f.ac} onChange={(n) => n !== null && patch({ ac: n })} /></Field>
          <Field label="AC note"><input aria-label="AC note" value={f.acNote} onChange={(e) => patch({ acNote: e.target.value })} /></Field>
          <Field label="HP"><Num label="HP" value={f.hp} onChange={(n) => n !== null && patch({ hp: n })} /></Field>
          <Field label="HP dice"><input aria-label="HP dice" value={f.hpRoll} onChange={(e) => patch({ hpRoll: e.target.value })} /></Field>
        </div>
        <fieldset className="ce-sub">
          <legend>Speed</legend>
          <div className="ce-grid">
            {(["walk", "burrow", "climb", "fly", "swim"] as const).map((k) => {
              const l = `${k[0].toUpperCase()}${k.slice(1)} speed`;
              return <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} (ft.)`}><Num label={l} nullable value={f.speed[k]} onChange={(n) => speed({ [k]: n, ...(k === "fly" && n === null ? { hover: false } : {}) })} /></Field>;
            })}
            <label className="ce-check ce-check-field">
              <input type="checkbox" aria-label="Hover" disabled={f.speed.fly === null} checked={f.speed.hover} onChange={(e) => speed({ hover: e.target.checked })} />
              <span aria-hidden="true">Hover</span>
            </label>
            <Field label="Other speed"><input aria-label="Other speed" value={f.speed.other} onChange={(e) => speed({ other: e.target.value })} /></Field>
          </div>
        </fieldset>
      </Section>

      <Section title="Abilities">
        <div className="ce-abilities">
          {ABILITIES.map((a) => (
            <label key={a} className="ce-field ce-ability">
              <span>{ABBR(a)}</span>
              <Num label={ABBR(a)} value={f.abilities[a]} onChange={(n) => n !== null && patch({ abilities: { ...f.abilities, [a]: n } })} />
              <output aria-label={`${ABBR(a)} modifier`}>{signed(abilityMod(f.abilities[a]))}</output>
            </label>
          ))}
        </div>
      </Section>

      {ENTRY_SECTIONS.map(([title, key, noun, addLabel]) => {
        const list = f[key];
        const setList = (l: Entry[]) => patch({ [key]: l });
        return (
          <Section key={key} title={title}>
            {list.length > 0 && (
              <ul className="ce-entries">
                {list.map((en, i) => (
                  <EntryCard key={i} noun={noun} index={i} count={list.length} entry={en}
                    onChange={(e) => setList(list.map((x, j) => (j === i ? e : x)))}
                    onMove={(d) => setList(move(list, i, d))}
                    onRemove={() => setList(list.filter((_, j) => j !== i))}>
                    {key !== "traits" && (
                      <AttackBuilder id={`${noun} ${i + 1}`} abilities={f.abilities} pb={f.pb} onWrite={(desc) => setList(list.map((x, j) => (j === i ? { ...x, desc } : x)))} />
                    )}
                  </EntryCard>
                ))}
              </ul>
            )}
            <div className="ce-add">
              <button type="button" onClick={() => setList([...list, { name: "", desc: "" }])}>{addLabel}</button>
              {key === "legendaryActions" && list.length > 0 && (
                <Field label="Uses per round"><Num label="Uses per round" value={f.legendaryUses} onChange={(n) => n !== null && patch({ legendaryUses: n })} /></Field>
              )}
            </div>
          </Section>
        );
      })}

      <Section title="Saving throws">
        <div className="ce-saves">
          {ABILITIES.map((a) => {
            const row = f.saves.find((s) => s.ability === a);
            return (
              <div key={a} className="ce-save">
                <label className="ce-check">
                  <input type="checkbox" aria-label={`${ABBR(a)} save`} checked={!!row}
                    onChange={(e) => patch({ saves: e.target.checked ? [...f.saves, { ability: a, bonus: null }] : f.saves.filter((s) => s.ability !== a) })} />
                  <span aria-hidden="true">{ABBR(a)} save</span>
                </label>
                {row && (
                  <BonusInput label={`${ABBR(a)} save bonus`} override={row.bonus} auto={autoSaveBonus(f.abilities, a, f.pb)}
                    onChange={(bonus) => patch({ saves: f.saves.map((s) => (s.ability === a ? { ...s, bonus } : s)) })} />
                )}
              </div>
            );
          })}
        </div>
        {f.otherSaves.length > 0 && (
          <ul className="ce-chips">
            {f.otherSaves.map((o, i) => (
              <li key={`${o}-${i}`}><span>{o}</span>
                <button type="button" aria-label={`Remove other save ${o}`} onClick={() => patch({ otherSaves: f.otherSaves.filter((_, j) => j !== i) })}>Remove</button></li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Skills">
        {f.skills.length > 0 && (
          <ul className="ce-skills">
            {f.skills.map((row) => {
              const def = SKILLS.find((s) => s.key === row.key)!;
              const setRow = (p: Partial<typeof row>) => patch({ skills: f.skills.map((s) => (s.key === row.key ? { ...s, ...p } : s)) });
              return (
                <li key={row.key}>
                  <span className="ce-skill-name">{def.label}</span>
                  <select aria-label={`${def.label} level`} value={row.level} onChange={(e) => setRow({ level: e.target.value as "proficient" | "expertise" })}>
                    <option value="proficient">Proficient</option>
                    <option value="expertise">Expertise</option>
                  </select>
                  <BonusInput label={`${def.label} bonus`} override={row.bonus} auto={autoSkillBonus(f.abilities, row.key, row.level, f.pb)} onChange={(bonus) => setRow({ bonus })} />
                  <button type="button" aria-label={`Remove ${def.label}`} onClick={() => patch({ skills: f.skills.filter((s) => s.key !== row.key) })}>Remove</button>
                </li>
              );
            })}
          </ul>
        )}
        {f.otherSkills.length > 0 && (
          <ul className="ce-chips">
            {f.otherSkills.map((o, i) => (
              <li key={`${o}-${i}`}><span>{o}</span>
                <button type="button" aria-label={`Remove other skill ${o}`} onClick={() => patch({ otherSkills: f.otherSkills.filter((_, j) => j !== i) })}>Remove</button></li>
            ))}
          </ul>
        )}
        {availableSkills.length > 0 && (
          <div className="ce-add">
            <select aria-label="Add skill" value={pickedSkill} onChange={(e) => setSkillToAdd(e.target.value)}>
              {availableSkills.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button type="button" aria-label="Add selected skill" onClick={() => patch({ skills: [...f.skills, { key: pickedSkill, level: "proficient", bonus: null }] })}>Add</button>
          </div>
        )}
      </Section>

      <Section title="Senses">
        <div className="ce-grid">
          {(["blindsight", "darkvision", "tremorsense", "truesight"] as const).map((k) => {
            const l = `${k[0].toUpperCase()}${k.slice(1)}`;
            return <Field key={k} label={`${l} (ft.)`}><Num label={l} nullable value={f.senses[k]} onChange={(n) => senses({ [k]: n, ...(k === "darkvision" && n === null ? { darkvisionUnimpeded: false } : {}) })} /></Field>;
          })}
          <label className="ce-check ce-check-field">
            <input type="checkbox" aria-label="Darkvision unimpeded by magical darkness" disabled={f.senses.darkvision === null} checked={f.senses.darkvisionUnimpeded}
              onChange={(e) => senses({ darkvisionUnimpeded: e.target.checked })} />
            <span aria-hidden="true">Unimpeded by magical darkness</span>
          </label>
          <Field label="Other senses"><input aria-label="Other senses" value={f.senses.other} onChange={(e) => senses({ other: e.target.value })} /></Field>
          <div className="ce-field">
            <span>Passive Perception (auto)</span>
            <span className="ce-bonus">
              <output className="ce-output" aria-label="Passive Perception">{f.senses.passiveOverride ?? computedPassive}</output>
              {f.senses.passiveOverride !== null && <button type="button" className="ce-auto" aria-label="Reset Passive Perception to auto" onClick={() => senses({ passiveOverride: null })}>Auto</button>}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Languages">
        {f.languages.length > 0 && (
          <ul className="ce-langs">
            {f.languages.map((l, i) => (
              <li key={i}>
                <input aria-label={`Language ${i + 1}`} list={`${ids}-langs`} value={l} onChange={(e) => patch({ languages: f.languages.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" aria-label={`Remove language ${i + 1}`} onClick={() => patch({ languages: f.languages.filter((_, j) => j !== i) })}>Remove</button>
              </li>
            ))}
          </ul>
        )}
        <AddRow label="New language" buttonLabel="Add language" list={`${ids}-langs`} onAdd={(v) => patch({ languages: [...f.languages, v] })} />
        <datalist id={`${ids}-langs`}>{LANGUAGE_SUGGESTIONS.map((l) => <option key={l} value={l} />)}</datalist>
        <div className="ce-grid">
          <Field label="Telepathy (ft.)"><Num label="Telepathy" nullable value={f.telepathy} onChange={(n) => patch({ telepathy: n })} /></Field>
          <Field label="Gear" wide><input aria-label="Gear" value={f.gear} onChange={(ev) => patch({ gear: ev.target.value })} /></Field>
        </div>
      </Section>

      <Section title="Defenses">
        <DefenseGroup title="Vulnerabilities" standard={DAMAGE_TYPES} list={f.vulnerabilities} onChange={(l) => patch({ vulnerabilities: l })} />
        <DefenseGroup title="Resistances" standard={DAMAGE_TYPES} list={f.resistances} onChange={(l) => patch({ resistances: l })} />
        <DefenseGroup title="Immunities" standard={DAMAGE_TYPES} list={f.immunities} onChange={(l) => patch({ immunities: l })} />
        <DefenseGroup title="Condition immunities" standard={CONDITIONS} list={f.conditionImmunities} onChange={(l) => patch({ conditionImmunities: l })} />
      </Section>

      <div className="row">
        <button type="submit" className="primary">Save</button>
        <button type="button" onClick={() => onDone(null)}>Cancel</button>
        {entry && <button type="button" className="danger" onClick={() => void deleteCustomEntry(entry.id).then(() => { selectStatBlock(campaignId, null); onDone(null); })}>Delete entry</button>}
      </div>
    </form>
    <UnreadNotice lines={unread} />
    {pasting && <PasteDialog read={readMonster} onFill={applyPaste} onClose={() => setPasting(false)} />}
    </>
  );
}
