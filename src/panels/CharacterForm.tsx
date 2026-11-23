import { passivePerceptionOf } from "../party/passive";
import { useSrdEquipment } from "../ui/useSrdEquipment";
import type { PartyMember } from "../storage/party";
import { useEffect, useState, type FormEvent } from "react";
import { asLanguages, asList, type PartyMemberInput } from "../storage/party";
import { GUARD } from "../ui/unsaved";
import SrdSelect from "../ui/SrdSelect";
import { loadCharacterData, type CharacterData } from "../srd/character";
import { matchSrd } from "../srd/match";
import { activeAutoFields, applyAuto, protectExisting, type AutoField } from "../party/autoSheet";
import {
  ABILITIES, ABILITY_NAMES, CURRENCIES, DAMAGE_DICE, DAMAGE_TYPES, asAttacks, attackAbilityMod, attackProficiency, proficiencyBonus, signed, attackDamageText, attackToHitText, ATTACK_ABILITY_LABELS, type AttackAbility, type AttackContext, asEquipment, attackLabel, isPack, newEquipmentEntry, toCount, type Attack, type EquipmentEntry, DEFAULT_ABILITIES, NO_COINS, SKILLS, SPELL_LEVELS,
  type AbilityKey, type SkillLevel,
} from "../party/sheet";

type ListKey = "features" | "proficiencies" | "spells";

/** Add/remove editor for a list of single-item entries. */
function ListEditor({ label, noun, items, onChange }: { label: string; noun: string; items: string[]; onChange: (items: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t) onChange([...items, t]);
    setDraft("");
  };
  return (
    <div className="wide list-editor" role="group" aria-label={label}>
      <span className="muted">{label}</span>
      <ul>
        {items.map((it, i) => (
          <li key={i}>
            <span>{it}</span>
            <button type="button" aria-label={`Remove ${noun} ${it}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="row">
        <input aria-label={`New ${noun}`} value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} aria-label={`Add ${noun}`}>Add</button>
      </div>
    </div>
  );
}

/** Count input shown on every equipment row; a cleared field waits for a number instead of snapping to 1. */
function CountInput({ of, value, onChange }: { of: string; value: number | undefined; onChange: (n: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <span className="qty"><span aria-hidden="true">Count</span>
      <input type="number" min={1} aria-label={`Count of ${of}`} value={text ?? String(value ?? 1)}
        onChange={(e) => { setText(e.target.value); if (e.target.valueAsNumber >= 1) onChange(toCount(e.target.valueAsNumber)); }}
        onBlur={() => setText(null)} />
    </span>
  );
}

/** Equipment: single items and packs that hold several items, each with a count. */
function EquipmentEditor({ items, onChange }: { items: EquipmentEntry[]; onChange: (items: EquipmentEntry[]) => void }) {
  const srdGear = useSrdEquipment();
  const [draft, setDraft] = useState("");
  const [draftCount, setDraftCount] = useState(1);
  const [packDrafts, setPackDrafts] = useState<Record<number, string>>({});
  const [packCounts, setPackCounts] = useState<Record<number, number>>({});
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setCollapsed((s) => { const n = new Set(s); if (!n.delete(i)) n.add(i); return n; });
  const remove = (i: number) => {
    onChange(items.filter((_, j) => j !== i));
    setCollapsed((s) => new Set([...s].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
  };
  const withCount = <T extends { name: string }>(x: T, n: number): T & { quantity?: number } => (n > 1 ? { ...x, quantity: n } : x);
  const add = (pack: boolean) => {
    const t = draft.trim();
    if (t) onChange([...items, newEquipmentEntry(t, toCount(draftCount), srdGear.items, pack)]);
    setDraft("");
    setDraftCount(1);
  };
  const patch = (i: number, e: EquipmentEntry) => onChange(items.map((x, j) => (j === i ? e : x)));
  const addToPack = (i: number) => {
    const t = (packDrafts[i] ?? "").trim();
    if (t) patch(i, { ...items[i], contents: [...(items[i].contents ?? []), withCount({ name: t }, toCount(packCounts[i] ?? 1))] });
    setPackDrafts({ ...packDrafts, [i]: "" });
    setPackCounts({ ...packCounts, [i]: 1 });
  };
  return (
    <div className="wide list-editor" role="group" aria-label="Equipment">
      <span className="muted">Equipment</span>
      <ul>
        {items.map((e, i) => (
          <li key={i} className={isPack(e) ? "pack" : undefined}>
            <div className="pack-head">
              {isPack(e)
                ? <button type="button" className="pack-toggle" aria-expanded={!collapsed.has(i)} aria-label={`${collapsed.has(i) ? "Expand" : "Collapse"} ${e.name}`} onClick={() => toggle(i)}>
                    <span aria-hidden="true">{collapsed.has(i) ? "▸" : "▾"}</span> {e.name} (pack{collapsed.has(i) ? `, ${e.contents!.length} item${e.contents!.length === 1 ? "" : "s"}` : ""})
                  </button>
                : <span>{e.name}</span>}
              <CountInput of={e.name} value={e.quantity} onChange={(n) => patch(i, withCount({ ...e, quantity: undefined }, n))} />
              <button type="button" aria-label={`Remove ${isPack(e) ? "pack" : "item"} ${e.name}`} onClick={() => remove(i)}>Remove</button>
            </div>
            {isPack(e) && !collapsed.has(i) && (
              <div className="pack-body">
                <ul>
                  {e.contents!.map((c, k) => (
                    <li key={k}><span>{c.name}</span>
                      <CountInput of={`${c.name} in ${e.name}`} value={c.quantity}
                        onChange={(n) => patch(i, { ...e, contents: e.contents!.map((x, m) => (m === k ? withCount({ name: x.name }, n) : x)) })} />
                      <button type="button" aria-label={`Remove ${c.name} from ${e.name}`} onClick={() => patch(i, { ...e, contents: e.contents!.filter((_, m) => m !== k) })}>Remove</button>
                    </li>
                  ))}
                </ul>
                <div className="row">
                  <input aria-label={`New item in ${e.name}`} list={srdGear.listId} value={packDrafts[i] ?? ""}
                    onChange={(ev) => setPackDrafts({ ...packDrafts, [i]: ev.target.value })}
                    onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addToPack(i); } }} />
                  <span className="qty"><span aria-hidden="true">Count</span>
                    <input type="number" min={1} aria-label={`Count for new item in ${e.name}`} value={Number.isNaN(packCounts[i]) ? "" : (packCounts[i] ?? 1)}
                      onChange={(ev) => setPackCounts({ ...packCounts, [i]: ev.target.valueAsNumber })}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addToPack(i); } }} />
                  </span>
                  <button type="button" aria-label={`Add to ${e.name}`} onClick={() => addToPack(i)}>Add</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="row">
        <input aria-label="New item" list={srdGear.listId} placeholder="Search SRD gear or type your own" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(false); } }} />
        <label className="qty">Count
          <input type="number" min={1} value={Number.isNaN(draftCount) ? "" : draftCount} onChange={(e) => setDraftCount(e.target.valueAsNumber)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(false); } }} />
        </label>
        <button type="button" onClick={() => add(false)} aria-label="Add item">Add</button>
        <button type="button" onClick={() => add(true)} aria-label="Add pack">Add as pack</button>
      </div>
      {srdGear.datalist}
    </div>
  );
}

const ATTACK_ABILITIES: AttackAbility[] = ["str", "dex", "finesse", "spell"];

const BLANK_ATTACK: Attack = { name: "", quantity: 1, ability: "str", proficient: true, magic: 0, count: 1, die: 8, bonus: 0, type: "slashing" };

const num = (x: number | undefined, fallback = 0) => (x === undefined || Number.isNaN(x) ? fallback : x);
const numValue = (x: number | undefined) => (x === undefined || Number.isNaN(x) ? "" : x);

/** "DEX +3 · Prof +2 · Magic +1" — where an attack's numbers come from. */
function attackBreakdown(a: Attack, ctx: AttackContext): string {
  if (!a.ability) return "Typed numbers (older attack)";
  const ab = a.ability === "spell" ? (ctx.spellcastingAbility?.toUpperCase() ?? "Spell") : a.ability === "finesse" ? "Finesse" : a.ability.toUpperCase();
  const parts = [`${ab} ${signed(attackAbilityMod(ctx, a))}`];
  if (a.proficient !== false) parts.push(`Prof ${signed(attackProficiency(ctx, a))}`);
  if (num(a.magic)) parts.push(`Magic ${signed(num(a.magic))}`);
  if (num(a.bonus)) parts.push(`Other ${signed(num(a.bonus))}`);
  return parts.join(" · ");
}

/** Clean up a draft before it is stored. */
const tidyAttack = (a: Attack): Attack => ({
  ...a, name: a.name.trim(), quantity: Math.max(1, num(a.quantity, 1)), magic: num(a.magic), count: Math.max(0, num(a.count)), bonus: num(a.bonus),
});

/**
 * Inputs for one attack, grouped as To hit and Damage. `of` suffixes the labels ("Ability of Rapier")
 * so an open existing attack never shares a label with the new-attack form.
 */
function AttackFields({ a, set, ctx, of }: { a: Attack; set: (patch: Partial<Attack>) => void; ctx: AttackContext; of?: string }) {
  const L = (base: string, joiner = "of") => (of ? `${base} ${joiner} ${of}` : base);
  const pb = proficiencyBonus(ctx.level);
  return (
    <>
      <div className="attack-row">
        <span className="attack-row-label">To hit</span>
        {a.ability ? (
          <>
            <label>Ability
              <select aria-label={L("Ability")} value={a.ability} onChange={(e) => set({ ability: e.target.value as AttackAbility })}>
                {ATTACK_ABILITIES.map((k) => <option key={k} value={k}>{ATTACK_ABILITY_LABELS[k]}</option>)}
              </select>
            </label>
            <label className="attack-check" title="Adds the proficiency bonus to both to-hit and damage">
              <input type="checkbox" aria-label={L("Proficient", "with")} checked={a.proficient !== false} onChange={(e) => set({ proficient: e.target.checked })} />
              Proficient <span className="muted">({signed(pb)} hit &amp; dmg)</span>
            </label>
            <label>Magic bonus<input aria-label={L("Magic bonus")} type="number" value={numValue(a.magic ?? 0)} onChange={(e) => set({ magic: e.target.valueAsNumber })} /></label>
          </>
        ) : (
          <label>Attack bonus<input aria-label={L("Attack bonus")} type="number" value={numValue(a.attackBonus ?? 0)} onChange={(e) => set({ attackBonus: e.target.valueAsNumber || 0 })} /></label>
        )}
      </div>
      <div className="attack-row">
        <span className="attack-row-label">Damage</span>
        <label>Dice count<input aria-label={L("Dice count")} type="number" min={0} value={numValue(a.count)} onChange={(e) => set({ count: e.target.valueAsNumber })} /></label>
        <label>Dice
          <select aria-label={L("Dice")} value={a.die} onChange={(e) => set({ die: Number(e.target.value) })}>
            <option value={0}>None</option>
            {DAMAGE_DICE.map((s) => <option key={s} value={s}>d{s}</option>)}
          </select>
        </label>
        <label>Damage type
          <select aria-label={L("Damage type")} value={a.type} onChange={(e) => set({ type: e.target.value })}>
            <option value="">—</option>
            {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {/* Older attacks kept a typed damage bonus; new ones get extra damage from proficiency. */}
        {(!a.ability || num(a.bonus) !== 0) && (
          <label>Extra damage<input aria-label={L("Extra damage")} type="number" value={numValue(a.bonus)} onChange={(e) => set({ bonus: e.target.valueAsNumber })} /></label>
        )}
      </div>
    </>
  );
}

/** One-line result plus where the numbers come from. */
function AttackPreview({ a, ctx }: { a: Attack; ctx: AttackContext }) {
  const t = tidyAttack(a);
  const hit = attackToHitText(t, ctx);
  return (
    <p className="attack-preview" aria-live="polite">
      <strong>{hit || "No to-hit"}</strong> — <strong>{attackDamageText(t, ctx)}</strong>
      <span className="muted"> · {attackBreakdown(t, ctx)}</span>
    </p>
  );
}

/** Structured attack entries: each shows its live numbers; Edit opens the same fields as the new-attack form. */
function AttackEditor({ items, onChange, ctx }: { items: Attack[]; onChange: (items: Attack[]) => void; ctx: AttackContext }) {
  const [d, setD] = useState<Attack>(BLANK_ATTACK);
  const [open, setOpen] = useState<number | null>(null);
  const change = (i: number, patch: Partial<Attack>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => {
    if (!d.name.trim()) return;
    onChange([...items, tidyAttack(d)]);
    setD({ ...BLANK_ATTACK, ability: d.ability, proficient: d.proficient });
  };
  return (
    <div className="wide list-editor attack-editor" role="group" aria-label="Attacks">
      <span className="muted">Attacks</span>
      {items.length > 0 && (
        <ul>
          {items.map((a, i) => (
            <li key={i} className={open === i ? "attack-item open" : "attack-item"}>
              <div className="attack-head">
                <span className="attack-name">{attackLabel(a)}</span>
                <span className="attack-sum">{attackToHitText(a, ctx) ? `${attackToHitText(a, ctx)} — ` : ""}{attackDamageText(a, ctx)}</span>
                <label className="qty">Quantity of {a.name}
                  <input type="number" min={1} value={a.quantity ?? 1} onChange={(e) => change(i, { quantity: Math.max(1, e.target.valueAsNumber || 1) })} />
                </label>
                <button type="button" aria-expanded={open === i} aria-label={`Edit attack ${a.name}`} onClick={() => setOpen(open === i ? null : i)}>{open === i ? "Done" : "Edit"}</button>
                <button type="button" aria-label={`Remove attack ${a.name}`} onClick={() => { onChange(items.filter((_, j) => j !== i)); setOpen(null); }}>Remove</button>
              </div>
              {open === i && (
                <div className="attack-body">
                  <AttackFields a={a} set={(p) => change(i, p)} ctx={ctx} of={a.name} />
                  <AttackPreview a={a} ctx={ctx} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <fieldset className="attack-new">
        <legend>New attack</legend>
        <div className="attack-row">
          <label className="attack-name-field">Attack name<input value={d.name} placeholder="e.g. Longsword" onChange={(e) => setD({ ...d, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /></label>
          <label>Quantity<input type="number" min={1} value={numValue(d.quantity ?? 1)} onChange={(e) => setD({ ...d, quantity: e.target.valueAsNumber })} /></label>
        </div>
        <AttackFields a={d} set={(p) => setD({ ...d, ...p })} ctx={ctx} />
        <div className="attack-foot">
          <AttackPreview a={d} ctx={ctx} />
          <button type="button" onClick={add} disabled={!d.name.trim()} aria-label="Add attack">Add attack</button>
        </div>
      </fieldset>
    </div>
  );
}

/** Collapsible form section; starts open when it already holds data (or `open` is forced). */
function Section({ title, open, className, children }: { title: string; open: boolean; className?: string; children: React.ReactNode }) {
  return (
    <details className="sheet-section" open={open}>
      <summary>{title}</summary>
      <div className={`sheet-section-body${className ? ` ${className}` : ""}`}>{children}</div>
    </details>
  );
}

/** "auto" tag on a computed field, or a Reset button once the DM has overridden it. Renders nothing when the field is not auto-driven. */
function AutoMark({ active, manual, label, onReset }: { active: boolean; manual: boolean; label: string; onReset: () => void }) {
  if (!active) return null;
  return manual
    ? <button type="button" className="auto-reset" onClick={onReset}>Reset {label} to auto</button>
    : <span className="auto-tag" title={`${label} follows class, level, species and abilities`}>auto</span>;
}

/** Generated entries (from class, background, species): shown read-only above the DM's own list. */
function GeneratedList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="wide generated-list" role="group" aria-label={label}>
      <span className="muted">{label} <span className="auto-tag">auto</span></span>
      <ul>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
    </div>
  );
}

const n = (x: number | undefined, fallback: number) => (x === undefined || Number.isNaN(x) ? fallback : x);

/** Full character-sheet editor. Labels of the basic fields match the quick Party form. */
export default function CharacterForm({ initial, onSave, onCancel }: { initial: PartyMemberInput; onSave: (v: PartyMemberInput) => void; onCancel: () => void }) {
  const [v, setV] = useState<PartyMemberInput>(initial);
  const set = <K extends keyof PartyMemberInput>(k: K, val: PartyMemberInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const [srd, setSrd] = useState<CharacterData | null>(null);
  useEffect(() => { let live = true; void loadCharacterData().then((d) => { if (live) setSrd(d); }, () => {}); return () => { live = false; }; }, []);
  // `v` holds what the DM typed; `w` is what the sheet shows: v with every non-manual auto field recomputed.
  const w: PartyMemberInput = srd ? applyAuto(v, srd) : v;
  const autoOn = srd ? activeAutoFields(v, srd) : [];
  const isAuto = (f: AutoField) => autoOn.includes(f);
  const isManual = (f: AutoField) => !!v.manual?.[f];
  const setManual = (f: AutoField) => setV((x) => ({ ...x, manual: { ...x.manual, [f]: true } }));
  const resetAuto = (f: AutoField) => setV((x) => { const { [f]: _gone, ...rest } = x.manual ?? {}; return { ...x, manual: rest }; });
  const mark = (f: AutoField, label: string) => <AutoMark active={isAuto(f)} manual={isManual(f)} label={label} onReset={() => resetAuto(f)} />;
  const abilities = w.abilities ?? DEFAULT_ABILITIES;
  const coins = v.coins ?? NO_COINS;
  const slotsMax = w.spellSlotsMax ?? [];

  const text = (k: keyof PartyMemberInput, label: string, auto?: AutoField) => {
    const field = (
      <label>{label}<input autoFocus={k === "name"} value={(w[k] as string | undefined) ?? ""}
        onChange={(e) => { set(k, e.target.value as never); if (auto) setManual(auto); }} /></label>
    );
    return auto ? <div className="auto-field">{field}{mark(auto, label)}</div> : field;
  };
  const area = (k: keyof PartyMemberInput, label: string) => (
    <label className="wide">{label}<textarea rows={3} value={(v[k] as string | undefined) ?? ""} onChange={(e) => set(k, e.target.value as never)} /></label>
  );
  const list = (k: ListKey, label: string, noun: string) => (
    <ListEditor label={label} noun={noun} items={asList(v[k])} onChange={(items) => set(k, items)} />
  );
  const num = (k: "level" | "ac" | "maxHp" | "currentHp" | "passivePerception" | "xp", label: string, auto?: AutoField) => {
    const field = (
      <label>{label}
        <input type="number" value={Number.isNaN(w[k]) ? "" : (w[k] ?? (k === "currentHp" ? w.maxHp : ""))}
          onChange={(e) => { set(k, e.target.valueAsNumber as never); if (auto) setManual(auto); }} />
      </label>
    );
    return auto ? <div className="auto-field">{field}{mark(auto, label)}</div> : field;
  };

  const toggleSave = (a: AbilityKey) => {
    const cur = w.saveProficiencies ?? [];
    set("saveProficiencies", cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]);
    setManual("saves");
  };
  const setSkill = (key: string, lvl: SkillLevel | "") => {
    const next = { ...(w.skills ?? {}) };
    if (lvl) next[key] = lvl; else delete next[key];
    set("skills", next);
  };
  const setSlots = (i: number, val: number) => {
    const max = [...slotsMax];
    while (max.length < 9) max.push(0);
    max[i] = Number.isNaN(val) ? 0 : Math.max(0, val);
    set("spellSlotsMax", max);
    setManual("spellSlots");
    set("spellSlotsUsed", (v.spellSlotsUsed ?? []).map((u, j) => (j === i ? Math.min(u, max[i]) : u)));
  };

  /** Names that match an SRD entry (older records, typed text) are saved with its canonical name and id. */
  const resolveSrd = (text: string | undefined, id: string | undefined, entries: { id: string; name: string }[] | undefined) => {
    const hit = entries && (id ? entries.find((e) => e.id === id) : matchSrd(text, entries));
    return hit ? { text: hit.name, id: hit.id } : { text: text?.trim() ?? "", id: entries ? undefined : id };
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) return;
    const cls = resolveSrd(v.class, v.classId, srd?.classes);
    const bg = resolveSrd(v.background, v.backgroundId, srd?.backgrounds);
    const sp = resolveSrd(v.race, v.speciesId, srd?.species);
    // An older record that only now matches an SRD entry keeps the numbers it already holds.
    const fresh = (!v.classId && cls.id) || (!v.speciesId && sp.id) || (!v.backgroundId && bg.id);
    const picked = { ...v, class: cls.text, classId: cls.id, background: bg.text, backgroundId: bg.id, race: sp.text, speciesId: sp.id, ...(fresh ? { manual: protectExisting(v) } : {}) };
    const a = srd ? applyAuto({ ...picked, abilities: { ...DEFAULT_ABILITIES, ...picked.abilities } }, srd) : picked;
    const maxHp = n(a.maxHp, 0);
    onSave({
      ...a, attacks: asAttacks(v.attacks), equipment: asEquipment(v.equipment), name: v.name.trim(), level: n(a.level, 1) || 1, ac: n(v.ac, 0), maxHp,
      currentHp: Math.max(0, Math.min(n(a.currentHp, maxHp), maxHp)),
      passivePerception: passivePerceptionOf({ ...a, abilities, level: n(a.level, 1) || 1 } as PartyMember),
      xp: v.xp === undefined || Number.isNaN(v.xp) ? undefined : v.xp,
      abilities: ABILITIES.reduce((acc, a) => ({ ...acc, [a]: n(abilities[a], 10) }), DEFAULT_ABILITIES),
      coins: CURRENCIES.reduce((acc, c) => ({ ...acc, [c]: n(coins[c], 0) }), NO_COINS),
    });
  };

  return (
    <form {...GUARD} className="sheet-form" onSubmit={submit} aria-label="Character sheet form">
      <fieldset><legend>Identity</legend>
        {text("name", "Name")}
        <SrdSelect label="Class" entries={srd?.classes} text={v.class} id={v.classId} onChange={(t, id) => setV((x) => ({ ...x, class: t, classId: id }))} />
        {num("level", "Level", "level")}
        <SrdSelect label="Species" entries={srd?.species} text={v.race ?? ""} id={v.speciesId} onChange={(t, id) => setV((x) => ({ ...x, race: t, speciesId: id }))} />
        <SrdSelect label="Background" entries={srd?.backgrounds} text={v.background ?? ""} id={v.backgroundId} onChange={(t, id) => setV((x) => ({ ...x, background: t, backgroundId: id }))} />
        {text("alignment", "Alignment")}{text("playerName", "Player")}{num("xp", "XP")}
      </fieldset>
      <fieldset><legend>Combat</legend>
        {num("ac", "AC")}{num("maxHp", "Max HP", "maxHp")}{num("currentHp", "Current HP")}
        {text("speed", "Speed", "speed")}{text("hitDice", "Hit Dice", "hitDice")}
        <label className="check"><input type="checkbox" checked={!!v.inspiration} onChange={(e) => set("inspiration", e.target.checked)} />Heroic Inspiration</label>
      </fieldset>
      <fieldset className="abilities"><legend>Ability scores and saving throws {mark("saves", "Saving throws")}</legend>
        {ABILITIES.map((a) => (
          <div key={a} className="ability-col">
            <label>{a.toUpperCase()} score
              <input type="number" min={1} max={30} value={Number.isNaN(abilities[a]) ? "" : abilities[a]}
                onChange={(e) => set("abilities", { ...abilities, [a]: e.target.valueAsNumber })} />
            </label>
            <label className="check"><input type="checkbox" checked={(w.saveProficiencies ?? []).includes(a)} onChange={() => toggleSave(a)} />{ABILITY_NAMES[a]} save</label>
          </div>
        ))}
      </fieldset>
      <Section title="Skills" open={Object.keys(w.skills ?? {}).length > 0} className="skills-grid">
        {SKILLS.map((s) => (
          <label key={s.key} className="inline">{s.label} ({s.ability.toUpperCase()})
            <select value={w.skills?.[s.key] ?? ""} onChange={(e) => setSkill(s.key, e.target.value as SkillLevel | "")}>
              <option value="">—</option><option value="proficient">Proficient</option><option value="expertise">Expertise</option>
            </select>
          </label>
        ))}
      </Section>
      <Section title="Spellcasting" open={!!w.spellcastingAbility || slotsMax.some((x) => x > 0) || asList(v.spells).length > 0}>
        <div className="wide auto-field">
          <label className="inline">Spellcasting ability
            <select value={w.spellcastingAbility ?? ""} onChange={(e) => { set("spellcastingAbility", (e.target.value || undefined) as AbilityKey | undefined); setManual("spellcastingAbility"); }}>
              <option value="">None</option>
              {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
            </select>
          </label>
          {mark("spellcastingAbility", "Spellcasting ability")}
        </div>
        <div className="wide auto-field">{mark("spellSlots", "Spell slots")}</div>
        <div className="wide slot-row">
          {SPELL_LEVELS.map((l) => (
            <label key={l}>Level {l} slots
              <input type="number" min={0} value={slotsMax[l - 1] ?? 0} onChange={(e) => setSlots(l - 1, e.target.valueAsNumber)} />
            </label>
          ))}
        </div>
        {list("spells", "Spells known / prepared", "spell")}
      </Section>
      <Section title="Equipment and coin" open={!!(v.attacks?.length || v.equipment?.length || CURRENCIES.some((c) => (coins[c] ?? 0) > 0))}>
        <div className="wide coin-row">
          {CURRENCIES.map((c) => (
            <label key={c}>{c.toUpperCase()}
              <input type="number" min={0} value={Number.isNaN(coins[c]) ? "" : coins[c]} onChange={(e) => set("coins", { ...coins, [c]: e.target.valueAsNumber })} />
            </label>
          ))}
        </div>
        <AttackEditor ctx={{ abilities, level: n(w.level, 1) || 1, spellcastingAbility: w.spellcastingAbility }} items={asAttacks(v.attacks)} onChange={(items) => set("attacks", items)} /><EquipmentEditor items={asEquipment(v.equipment)} onChange={(items) => set("equipment", items)} />
      </Section>
      <Section title="Features and proficiencies" open={(w.autoFeatures?.length ?? 0) + (w.autoProficiencies?.length ?? 0) + asList(v.features).length + asList(v.proficiencies).length + asLanguages(v.languages).length > 0}>
        <GeneratedList label="Generated features" items={w.autoFeatures ?? []} />{list("features", "Features and traits", "trait")}<GeneratedList label="Generated proficiencies" items={w.autoProficiencies ?? []} />{list("proficiencies", "Armor, weapon and tool proficiencies", "proficiency")}<ListEditor label="Languages" noun="language" items={asLanguages(v.languages)} onChange={(items) => set("languages", items)} />
      </Section>
      <Section title="Story" open={!!(v.personality || v.backstory || v.notes)}>
        {area("personality", "Personality, ideals, bonds, flaws")}{area("backstory", "Backstory")}{area("notes", "Notes")}
      </Section>
      <div className="row">
        <button type="submit" className="primary">Save member</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
