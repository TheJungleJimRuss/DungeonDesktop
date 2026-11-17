import { useState, type FormEvent } from "react";
import { asList, type PartyMemberInput } from "../storage/party";
import {
  ABILITIES, ABILITY_NAMES, CURRENCIES, DAMAGE_DICE, DAMAGE_TYPES, asAttacks, attackDamageText, asEquipment, attackLabel, isPack, type Attack, type EquipmentEntry, DEFAULT_ABILITIES, NO_COINS, SKILLS, SPELL_LEVELS,
  type AbilityKey, type SkillLevel,
} from "../party/sheet";

type ListKey = "features" | "proficiencies";

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

/** Equipment: single items and packs that hold several items. */
function EquipmentEditor({ items, onChange }: { items: EquipmentEntry[]; onChange: (items: EquipmentEntry[]) => void }) {
  const [draft, setDraft] = useState("");
  const [packDrafts, setPackDrafts] = useState<Record<number, string>>({});
  const add = (pack: boolean) => {
    const t = draft.trim();
    if (t) onChange([...items, pack ? { name: t, contents: [] } : { name: t }]);
    setDraft("");
  };
  const patch = (i: number, e: EquipmentEntry) => onChange(items.map((x, j) => (j === i ? e : x)));
  const addToPack = (i: number) => {
    const t = (packDrafts[i] ?? "").trim();
    if (t) patch(i, { ...items[i], contents: [...(items[i].contents ?? []), t] });
    setPackDrafts({ ...packDrafts, [i]: "" });
  };
  return (
    <div className="wide list-editor" role="group" aria-label="Equipment">
      <span className="muted">Equipment</span>
      <ul>
        {items.map((e, i) => (
          <li key={i} className={isPack(e) ? "pack" : undefined}>
            <div className="pack-head">
              <span>{e.name}{isPack(e) ? " (pack)" : ""}</span>
              <button type="button" aria-label={`Remove ${isPack(e) ? "pack" : "item"} ${e.name}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
            </div>
            {isPack(e) && (
              <div className="pack-body">
                <ul>
                  {e.contents!.map((c, k) => (
                    <li key={k}><span>{c}</span>
                      <button type="button" aria-label={`Remove ${c} from ${e.name}`} onClick={() => patch(i, { ...e, contents: e.contents!.filter((_, m) => m !== k) })}>Remove</button>
                    </li>
                  ))}
                </ul>
                <div className="row">
                  <input aria-label={`New item in ${e.name}`} value={packDrafts[i] ?? ""}
                    onChange={(ev) => setPackDrafts({ ...packDrafts, [i]: ev.target.value })}
                    onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addToPack(i); } }} />
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
        <button type="button" onClick={() => add(false)} aria-label="Add item">Add</button>
        <button type="button" onClick={() => add(true)} aria-label="Add pack">Add as pack</button>
      </div>
    </div>
  );
}

const BLANK_ATTACK: Attack = { name: "", quantity: 1, count: 1, die: 8, bonus: 0, type: "slashing" };

/** Structured attack entries: name, dice count, die, damage bonus and damage type. */
function AttackEditor({ items, onChange }: { items: Attack[]; onChange: (items: Attack[]) => void }) {
  const [d, setD] = useState<Attack>(BLANK_ATTACK);
  const int = (x: number) => (Number.isNaN(x) ? 0 : x);
  const add = () => {
    if (!d.name.trim()) return;
    onChange([...items, { ...d, name: d.name.trim(), quantity: Math.max(1, int(d.quantity ?? 1)), count: Math.max(0, int(d.count)), bonus: int(d.bonus) }]);
    setD(BLANK_ATTACK);
  };
  return (
    <div className="wide list-editor" role="group" aria-label="Attacks">
      <span className="muted">Attacks</span>
      <ul>
        {items.map((a, i) => (
          <li key={i}>
            <span>{attackLabel(a)} — {attackDamageText(a)}</span>
            <label className="qty">Quantity of {a.name}
              <input type="number" min={1} value={a.quantity ?? 1}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, e.target.valueAsNumber || 1) } : x)))} />
            </label>
            <button type="button" aria-label={`Remove attack ${a.name}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="attack-new">
        <label>Attack name<input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /></label>
        <label>Quantity<input type="number" min={1} value={Number.isNaN(d.quantity ?? 1) ? "" : (d.quantity ?? 1)} onChange={(e) => setD({ ...d, quantity: e.target.valueAsNumber })} /></label>
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

const n = (x: number | undefined, fallback: number) => (x === undefined || Number.isNaN(x) ? fallback : x);

/** Full character-sheet editor. Labels of the basic fields match the quick Party form. */
export default function CharacterForm({ initial, onSave, onCancel }: { initial: PartyMemberInput; onSave: (v: PartyMemberInput) => void; onCancel: () => void }) {
  const [v, setV] = useState<PartyMemberInput>(initial);
  const set = <K extends keyof PartyMemberInput>(k: K, val: PartyMemberInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const abilities = v.abilities ?? DEFAULT_ABILITIES;
  const coins = v.coins ?? NO_COINS;
  const slotsMax = v.spellSlotsMax ?? [];

  const text = (k: keyof PartyMemberInput, label: string) => (
    <label>{label}<input value={(v[k] as string | undefined) ?? ""} onChange={(e) => set(k, e.target.value as never)} /></label>
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
      passivePerception: n(v.passivePerception, 0),
      xp: v.xp === undefined || Number.isNaN(v.xp) ? undefined : v.xp,
      abilities: ABILITIES.reduce((acc, a) => ({ ...acc, [a]: n(abilities[a], 10) }), DEFAULT_ABILITIES),
      coins: CURRENCIES.reduce((acc, c) => ({ ...acc, [c]: n(coins[c], 0) }), NO_COINS),
    });
  };

  return (
    <form className="sheet-form" onSubmit={submit} aria-label="Character sheet form">
      <fieldset><legend>Identity</legend>
        {text("name", "Name")}{text("class", "Class")}{num("level", "Level")}{text("race", "Species")}
        {text("background", "Background")}{text("alignment", "Alignment")}{text("playerName", "Player")}{num("xp", "XP")}
      </fieldset>
      <fieldset><legend>Combat</legend>
        {num("ac", "AC")}{num("maxHp", "Max HP")}{num("currentHp", "Current HP")}{num("passivePerception", "Passive Perception")}
        {text("speed", "Speed")}{text("hitDice", "Hit Dice")}
        <label className="check"><input type="checkbox" checked={!!v.inspiration} onChange={(e) => set("inspiration", e.target.checked)} />Heroic Inspiration</label>
      </fieldset>
      <fieldset><legend>Ability scores</legend>
        {ABILITIES.map((a) => (
          <label key={a}>{a.toUpperCase()} score
            <input type="number" min={1} max={30} value={Number.isNaN(abilities[a]) ? "" : abilities[a]}
              onChange={(e) => set("abilities", { ...abilities, [a]: e.target.valueAsNumber })} />
          </label>
        ))}
      </fieldset>
      <fieldset><legend>Saving throw proficiencies</legend>
        {ABILITIES.map((a) => (
          <label key={a} className="check"><input type="checkbox" checked={(v.saveProficiencies ?? []).includes(a)} onChange={() => toggleSave(a)} />{ABILITY_NAMES[a]} save</label>
        ))}
      </fieldset>
      <fieldset><legend>Skills</legend>
        {SKILLS.map((s) => (
          <label key={s.key}>{s.label} ({s.ability.toUpperCase()})
            <select value={v.skills?.[s.key] ?? ""} onChange={(e) => setSkill(s.key, e.target.value as SkillLevel | "")}>
              <option value="">—</option><option value="proficient">Proficient</option><option value="expertise">Expertise</option>
            </select>
          </label>
        ))}
      </fieldset>
      <fieldset><legend>Spellcasting</legend>
        <label>Spellcasting ability
          <select value={v.spellcastingAbility ?? ""} onChange={(e) => set("spellcastingAbility", (e.target.value || undefined) as AbilityKey | undefined)}>
            <option value="">None</option>
            {ABILITIES.map((a) => <option key={a} value={a}>{ABILITY_NAMES[a]}</option>)}
          </select>
        </label>
        {SPELL_LEVELS.map((l) => (
          <label key={l}>Level {l} slots
            <input type="number" min={0} value={slotsMax[l - 1] ?? 0} onChange={(e) => setSlots(l - 1, e.target.valueAsNumber)} />
          </label>
        ))}
        {area("spells", "Spells known / prepared")}
      </fieldset>
      <fieldset><legend>Equipment and coin</legend>
        {CURRENCIES.map((c) => (
          <label key={c}>{c.toUpperCase()}
            <input type="number" min={0} value={Number.isNaN(coins[c]) ? "" : coins[c]} onChange={(e) => set("coins", { ...coins, [c]: e.target.valueAsNumber })} />
          </label>
        ))}
        <AttackEditor items={asAttacks(v.attacks)} onChange={(items) => set("attacks", items)} /><EquipmentEditor items={asEquipment(v.equipment)} onChange={(items) => set("equipment", items)} />
      </fieldset>
      <fieldset><legend>Features and proficiencies</legend>
        {list("features", "Features and traits", "trait")}{list("proficiencies", "Armor, weapon and tool proficiencies", "proficiency")}{text("languages", "Languages")}
      </fieldset>
      <fieldset><legend>Story</legend>
        {area("personality", "Personality, ideals, bonds, flaws")}{area("backstory", "Backstory")}{area("notes", "Notes")}
      </fieldset>
      <div className="row">
        <button type="submit" className="primary">Save member</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
