import { passivePerceptionOf } from "../party/passive";
import type { PartyMember } from "../storage/party";
import { useState, type FormEvent } from "react";
import { asLanguages, asList, type PartyMemberInput } from "../storage/party";
import { GUARD } from "../ui/unsaved";
import {
  ABILITIES, ABILITY_NAMES, CURRENCIES, DAMAGE_DICE, DAMAGE_TYPES, asAttacks, attackDamageText, attackToHitText, asEquipment, attackLabel, isPack, toCount, type Attack, type EquipmentEntry, DEFAULT_ABILITIES, NO_COINS, SKILLS, SPELL_LEVELS,
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
    if (t) onChange([...items, withCount(pack ? { name: t, contents: [] } : { name: t }, toCount(draftCount))]);
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
                  <input aria-label={`New item in ${e.name}`} value={packDrafts[i] ?? ""}
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
        <input aria-label="New item" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(false); } }} />
        <label className="qty">Count
          <input type="number" min={1} value={Number.isNaN(draftCount) ? "" : draftCount} onChange={(e) => setDraftCount(e.target.valueAsNumber)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(false); } }} />
        </label>
        <button type="button" onClick={() => add(false)} aria-label="Add item">Add</button>
        <button type="button" onClick={() => add(true)} aria-label="Add pack">Add as pack</button>
      </div>
    </div>
  );
}

const BLANK_ATTACK: Attack = { name: "", quantity: 1, attackBonus: 0, count: 1, die: 8, bonus: 0, type: "slashing" };

/** Structured attack entries: name, dice count, die, damage bonus and damage type. */
function AttackEditor({ items, onChange }: { items: Attack[]; onChange: (items: Attack[]) => void }) {
  const [d, setD] = useState<Attack>(BLANK_ATTACK);
  const int = (x: number) => (Number.isNaN(x) ? 0 : x);
  const add = () => {
    if (!d.name.trim()) return;
    onChange([...items, { ...d, name: d.name.trim(), quantity: Math.max(1, int(d.quantity ?? 1)), attackBonus: int(d.attackBonus ?? 0), count: Math.max(0, int(d.count)), bonus: int(d.bonus) }]);
    setD(BLANK_ATTACK);
  };
  return (
    <div className="wide list-editor" role="group" aria-label="Attacks">
      <span className="muted">Attacks</span>
      <ul>
        {items.map((a, i) => (
          <li key={i}>
            <span>{attackLabel(a)}{a.attackBonus ? ` ${attackToHitText(a)}` : ""} — {attackDamageText(a)}</span>
            <label className="qty">Quantity of {a.name}
              <input type="number" min={1} value={a.quantity ?? 1}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, e.target.valueAsNumber || 1) } : x)))} />
            </label>
            <label className="qty">Attack bonus of {a.name}
              <input type="number" value={a.attackBonus ?? 0}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, attackBonus: e.target.valueAsNumber || 0 } : x)))} />
            </label>
            <button type="button" aria-label={`Remove attack ${a.name}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="attack-new">
        <label>Attack name<input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /></label>
        <label>Quantity<input type="number" min={1} value={Number.isNaN(d.quantity ?? 1) ? "" : (d.quantity ?? 1)} onChange={(e) => setD({ ...d, quantity: e.target.valueAsNumber })} /></label>
        <label>Attack bonus<input type="number" value={Number.isNaN(d.attackBonus ?? 0) ? "" : (d.attackBonus ?? 0)} onChange={(e) => setD({ ...d, attackBonus: e.target.valueAsNumber })} /></label>
        <label>Dice count<input type="number" min={0} value={Number.isNaN(d.count) ? "" : d.count} onChange={(e) => setD({ ...d, count: e.target.valueAsNumber })} /></label>
        <label>Dice
          <select value={d.die} onChange={(e) => setD({ ...d, die: Number(e.target.value) })}>
            <option value={0}>None</option>
            {DAMAGE_DICE.map((s) => <option key={s} value={s}>d{s}</option>)}
          </select>
        </label>
        <label>Damage bonus<input type="number" value={Number.isNaN(d.bonus) ? "" : d.bonus} onChange={(e) => setD({ ...d, bonus: e.target.valueAsNumber })} /></label>
        <label>Damage type
          <select value={d.type} onChange={(e) => setD({ ...d, type: e.target.value })}>
            <option value="">—</option>
            {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button type="button" onClick={add} aria-label="Add attack">Add</button>
      </div>
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

const n = (x: number | undefined, fallback: number) => (x === undefined || Number.isNaN(x) ? fallback : x);

/** Full character-sheet editor. Labels of the basic fields match the quick Party form. */
export default function CharacterForm({ initial, onSave, onCancel }: { initial: PartyMemberInput; onSave: (v: PartyMemberInput) => void; onCancel: () => void }) {
  const [v, setV] = useState<PartyMemberInput>(initial);
  const set = <K extends keyof PartyMemberInput>(k: K, val: PartyMemberInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const abilities = v.abilities ?? DEFAULT_ABILITIES;
  const coins = v.coins ?? NO_COINS;
  const slotsMax = v.spellSlotsMax ?? [];

  const text = (k: keyof PartyMemberInput, label: string) => (
    <label>{label}<input autoFocus={k === "name"} value={(v[k] as string | undefined) ?? ""} onChange={(e) => set(k, e.target.value as never)} /></label>
  );
  const area = (k: keyof PartyMemberInput, label: string) => (
    <label className="wide">{label}<textarea rows={3} value={(v[k] as string | undefined) ?? ""} onChange={(e) => set(k, e.target.value as never)} /></label>
  );
  const list = (k: ListKey, label: string, noun: string) => (
    <ListEditor label={label} noun={noun} items={asList(v[k])} onChange={(items) => set(k, items)} />
  );
  const num = (k: "level" | "ac" | "maxHp" | "currentHp" | "passivePerception" | "xp", label: string) => (
    <label>{label}
      <input type="number" value={Number.isNaN(v[k]) ? "" : (v[k] ?? (k === "currentHp" ? v.maxHp : ""))}
        onChange={(e) => set(k, e.target.valueAsNumber as never)} />
    </label>
  );

  const toggleSave = (a: AbilityKey) => {
    const cur = v.saveProficiencies ?? [];
    set("saveProficiencies", cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]);
  };
  const setSkill = (key: string, lvl: SkillLevel | "") => {
    const next = { ...(v.skills ?? {}) };
    if (lvl) next[key] = lvl; else delete next[key];
    set("skills", next);
  };
  const setSlots = (i: number, val: number) => {
    const max = [...slotsMax];
    while (max.length < 9) max.push(0);
    max[i] = Number.isNaN(val) ? 0 : Math.max(0, val);
    set("spellSlotsMax", max);
    set("spellSlotsUsed", (v.spellSlotsUsed ?? []).map((u, j) => (j === i ? Math.min(u, max[i]) : u)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) return;
    const maxHp = n(v.maxHp, 0);
    onSave({
      ...v, attacks: asAttacks(v.attacks), equipment: asEquipment(v.equipment), name: v.name.trim(), level: n(v.level, 1) || 1, ac: n(v.ac, 0), maxHp,
      currentHp: Math.max(0, Math.min(n(v.currentHp, maxHp), maxHp)),
      passivePerception: passivePerceptionOf({ ...v, abilities, level: n(v.level, 1) || 1 } as PartyMember),
      xp: v.xp === undefined || Number.isNaN(v.xp) ? undefined : v.xp,
      abilities: ABILITIES.reduce((acc, a) => ({ ...acc, [a]: n(abilities[a], 10) }), DEFAULT_ABILITIES),
      coins: CURRENCIES.reduce((acc, c) => ({ ...acc, [c]: n(coins[c], 0) }), NO_COINS),
    });
  };

  return (
    <form {...GUARD} className="sheet-form" onSubmit={submit} aria-label="Character sheet form">
      <fieldset><legend>Identity</legend>
        {text("name", "Name")}{text("class", "Class")}{num("level", "Level")}{text("race", "Species")}
        {text("background", "Background")}{text("alignment", "Alignment")}{text("playerName", "Player")}{num("xp", "XP")}
      </fieldset>
      <fieldset><legend>Combat</legend>
        {num("ac", "AC")}{num("maxHp", "Max HP")}{num("currentHp", "Current HP")}
        {text("speed", "Speed")}{text("hitDice", "Hit Dice")}
        <label className="check"><input type="checkbox" checked={!!v.inspiration} onChange={(e) => set("inspiration", e.target.checked)} />Heroic Inspiration</label>
      </fieldset>
      <fieldset className="abilities"><legend>Ability scores and saving throws</legend>
        {ABILITIES.map((a) => (
          <div key={a} className="ability-col">
            <label>{a.toUpperCase()} score
              <input type="number" min={1} max={30} value={Number.isNaN(abilities[a]) ? "" : abilities[a]}
                onChange={(e) => set("abilities", { ...abilities, [a]: e.target.valueAsNumber })} />
            </label>
            <label className="check"><input type="checkbox" checked={(v.saveProficiencies ?? []).includes(a)} onChange={() => toggleSave(a)} />{ABILITY_NAMES[a]} save</label>
          </div>
        ))}
      </fieldset>
      <Section title="Skills" open={Object.keys(v.skills ?? {}).length > 0} className="skills-grid">
        {SKILLS.map((s) => (
          <label key={s.key} className="inline">{s.label} ({s.ability.toUpperCase()})
            <select value={v.skills?.[s.key] ?? ""} onChange={(e) => setSkill(s.key, e.target.value as SkillLevel | "")}>
              <option value="">—</option><option value="proficient">Proficient</option><option value="expertise">Expertise</option>
            </select>
          </label>
        ))}
      </Section>
      <Section title="Spellcasting" open={!!v.spellcastingAbility || slotsMax.some((x) => x > 0) || asList(v.spells).length > 0}>
        <label className="wide inline">Spellcasting ability
          <select value={v.spellcastingAbility ?? ""} onChange={(e) => set("spellcastingAbility", (e.target.value || undefined) as AbilityKey | undefined)}>
            <option value="">None</option>
            {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
          </select>
        </label>
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
        <AttackEditor items={asAttacks(v.attacks)} onChange={(items) => set("attacks", items)} /><EquipmentEditor items={asEquipment(v.equipment)} onChange={(items) => set("equipment", items)} />
      </Section>
      <Section title="Features and proficiencies" open={asList(v.features).length + asList(v.proficiencies).length + asLanguages(v.languages).length > 0}>
        {list("features", "Features and traits", "trait")}{list("proficiencies", "Armor, weapon and tool proficiencies", "proficiency")}<ListEditor label="Languages" noun="language" items={asLanguages(v.languages)} onChange={(items) => set("languages", items)} />
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
