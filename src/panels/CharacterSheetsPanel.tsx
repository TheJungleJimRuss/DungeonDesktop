import { passivePerceptionOf } from "../party/passive";
import { useCallback, useEffect, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { useChangeVersion } from "../sync/changeBus";
import { addPartyMember, asLanguages, asList, currentHpOf, listParty, removePartyMember, updatePartyMember, type PartyMember, type PartyMemberInput } from "../storage/party";
import CharacterForm from "./CharacterForm";
import CoinPurse from "./CoinPurse";
import XpAward from "./XpAward";
import {
  ABILITIES, ABILITY_NAMES, ATTACK_ABILITY_LABELS, type AttackAbility, asAttacks, asEquipment, isPack, newEquipmentEntry, toCount, type EquipmentEntry, attackDamageText, attackToHitText, DEFAULT_ABILITIES, SKILLS, SPELL_LEVELS,
  abilityMod, applyHpChange, proficiencyBonus, saveBonus, signed, skillBonus, spellAttackBonus, spellSaveDc,
} from "../party/sheet";
import { EmptyState } from "../ui/PanelStates";
import { useSrdEquipment } from "../ui/useSrdEquipment";

/** Small one-line adder shown at the foot of a sheet section; `counted` adds a count field. */
function AddInline({ label, onAdd, extra, counted, list }: { label: string; onAdd: (text: string, count: number) => void; extra?: { label: string; onAdd: (text: string, count: number) => void }; counted?: boolean; list?: string }) {
  const [text, setText] = useState("");
  const [count, setCount] = useState(1);
  const take = (fn: (t: string, n: number) => void) => { const t = text.trim(); if (!t) return; fn(t, toCount(count)); setText(""); setCount(1); };
  return (
    <form className="add-inline" onSubmit={(e) => { e.preventDefault(); take(onAdd); }}>
      <input value={text} list={list} placeholder={`Add ${label}…`} aria-label={`Add ${label}`} onChange={(e) => setText(e.target.value)} />
      {counted && <input type="number" min={1} className="count-input" aria-label={`Count for new ${label}`} value={Number.isNaN(count) ? "" : count} onChange={(e) => setCount(e.target.valueAsNumber)} />}
      <button type="submit" aria-label={`Add ${label} to list`}>Add</button>
      {extra && <button type="button" onClick={() => take(extra.onAdd)}>{extra.label}</button>}
    </form>
  );
}

/** A × that only shows on hover/focus and asks before removing. */
function RemoveBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [asking, setAsking] = useState(false);
  if (asking) {
    return (
      <span className="confirm-inline" role="group" aria-label={`Confirm remove ${label}`}>
        <span className="muted">Remove?</span>
        <button type="button" className="danger" aria-label={`Confirm remove ${label}`} onClick={() => { setAsking(false); onClick(); }}>Yes</button>
        <button type="button" aria-label={`Cancel remove ${label}`} onClick={() => setAsking(false)}>No</button>
      </span>
    );
  }
  return <button type="button" className="x" aria-label={`Remove ${label}`} title="Remove" onClick={() => setAsking(true)}>×</button>;
}

/** Inline − count + for an item; the count saves on blur or Enter and never drops below 1. */
function Qty({ label, value, onChange }: { label: string; value?: number; onChange: (n: number) => void }) {
  const n = value ?? 1;
  const set = (next: number) => { const c = toCount(next); if (c !== n) onChange(c); };
  return (
    <span className="qty" role="group" aria-label={`${label} count`}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={n <= 1} onClick={() => set(n - 1)}>−</button>
      <input type="number" min={1} aria-label={`Quantity of ${label}`} defaultValue={n} key={n}
        onBlur={(e) => set(e.target.valueAsNumber)}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => set(n + 1)}>+</button>
    </span>
  );
}

/** A pack on the sheet; its contents fold away behind the pack name. */
function PackEntry({ pack, list, onRemove, onAddItem, onRemoveItem, onChange }: { pack: EquipmentEntry; list?: string; onRemove: () => void; onAddItem: (name: string, count: number) => void; onRemoveItem: (k: number) => void; onChange: (pack: EquipmentEntry) => void }) {
  const [open, setOpen] = useState(true);
  const n = pack.contents!.length;
  return (
    <li>
      <button type="button" className="pack-toggle" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${pack.name}`} onClick={() => setOpen(!open)}>
        <span aria-hidden="true">{open ? "▾" : "▸"}</span> {pack.name}
      </button>
      <Qty label={pack.name} value={pack.quantity} onChange={(quantity) => onChange({ ...pack, quantity })} />
      <RemoveBtn label={`pack ${pack.name}`} onClick={onRemove} />
      {!open && <span className="muted"> ({n} item{n === 1 ? "" : "s"})</span>}
      {open && (
        <>
          {!n && <span className="muted"> (empty pack)</span>}
          {n > 0 && <ul aria-label={`${pack.name} contents`}>{pack.contents!.map((c, k) => <li key={k}>{c.name}<Qty label={`${c.name} in ${pack.name}`} value={c.quantity} onChange={(quantity) => onChange({ ...pack, contents: pack.contents!.map((x, j) => (j === k ? { ...x, quantity } : x)) })} /><RemoveBtn label={`${c.name} from ${pack.name}`} onClick={() => onRemoveItem(k)} /></li>)}</ul>}
          <AddInline counted list={list} label={`item in ${pack.name}`} onAdd={onAddItem} />
        </>
      )}
    </li>
  );
}

const EMPTY: PartyMemberInput = { name: "", class: "", level: 1, ac: 10, maxHp: 1, passivePerception: 10, notes: "" };

function Text({ title, body }: { title: string; body?: string }) {
  if (!body?.trim()) return null;
  return <section className="sheet-card sheet-text"><h4>{title}</h4><p>{body}</p></section>;
}

function Items({ title, items, noun, onChange, generated }: { title: string; items?: string[] | string; noun: string; onChange: (next: string[]) => void; generated?: string[] }) {
  const list = asList(items);
  return (
    <section className="sheet-card sheet-text"><h4>{title}</h4>
      <ul className="sheet-items">{(generated ?? []).map((x, i) => <li key={`auto${i}`} className="generated">{x} <span className="auto-tag">auto</span></li>)}{list.map((x, i) => <li key={i}>{x}<RemoveBtn label={x} onClick={() => onChange(list.filter((_, j) => j !== i))} /></li>)}</ul>
      <AddInline label={noun} onAdd={(t) => onChange([...list, t])} />
    </section>
  );
}

function Sheet({ m }: { m: PartyMember }) {
  const ab = m.abilities ?? DEFAULT_ABILITIES;
  const pb = proficiencyBonus(m.level);
  const slotsMax = m.spellSlotsMax ?? [];
  const slotsUsed = m.spellSlotsUsed ?? [];
  const casting = m.spellcastingAbility;
  const setUsed = (i: number, used: number) => {
    const next = SPELL_LEVELS.map((_, j) => slotsUsed[j] ?? 0);
    next[i] = Math.max(0, Math.min(slotsMax[i] ?? 0, used));
    void updatePartyMember(m.id, { spellSlotsUsed: next });
  };
  const patch = (p: Partial<PartyMemberInput>) => void updatePartyMember(m.id, p);
  const attacks = asAttacks(m.attacks);
  const equipment = asEquipment(m.equipment);
  const srdGear = useSrdEquipment();
  const setPack = (i: number, contents: NonNullable<EquipmentEntry["contents"]>) => patch({ equipment: equipment.map((e, j) => (j === i ? { ...e, contents } : e)) });
  const roll = (label: string, bonus: number) => <span className="bonus" aria-label={label}>{signed(bonus)}</span>;

  return (
    <article className="sheet" aria-label={`${m.name} character sheet`}>
      <header>
        <h3>{m.name}</h3>
        <p className="muted">
          {[m.race, `${m.class || "Adventurer"} ${m.level}`, m.background, m.alignment].filter(Boolean).join(" · ")}
          {m.playerName ? ` · played by ${m.playerName}` : ""}
        </p>
        <XpAward m={m} editableTotal />
      </header>
      <dl className="sheet-vitals">
        <div><dt>AC</dt><dd>{m.ac}</dd></div>
        <div><dt>HP</dt><dd>{currentHpOf(m)}/{m.maxHp}</dd></div>
        <div><dt>Initiative</dt><dd>{roll("Initiative", abilityMod(ab.dex))}</dd></div>
        <div><dt>Speed</dt><dd>{m.speed || "—"}</dd></div>
        <div><dt>Proficiency</dt><dd>{signed(pb)}</dd></div>
        <div><dt>Passive Perception</dt><dd>{passivePerceptionOf(m)}</dd></div>
        <div><dt>Hit Dice</dt><dd>{m.hitDice || "—"}</dd></div>
        <div><dt>Inspiration</dt><dd>{m.inspiration ? "Yes" : "No"}</dd></div>
      </dl>

      <div className="sheet-abilities">
        {ABILITIES.map((a) => (
          <div key={a} className="ability" aria-label={ABILITY_NAMES[a]}>
            <span className="muted">{a.toUpperCase()}</span>
            <strong>{ab[a]}</strong>
            {roll(`${ABILITY_NAMES[a]} check`, abilityMod(ab[a]))}
          </div>
        ))}
      </div>

      <div className="sheet-grid">
        <section className="sheet-card">
          <h4>Saving throws</h4>
          <ul className="sheet-list">
            {ABILITIES.map((a) => {
              const prof = (m.saveProficiencies ?? []).includes(a);
              return <li key={a}><span aria-hidden>{prof ? "●" : "○"}</span> {ABILITY_NAMES[a]} {roll(`${ABILITY_NAMES[a]} save`, saveBonus(ab, a, m.level, prof))}</li>;
            })}
          </ul>
        </section>
        <section className="sheet-card">
          <h4>Skills</h4>
          <ul className="sheet-list">
            {SKILLS.map((s) => {
              const p = m.skills?.[s.key];
              return <li key={s.key}><span aria-hidden>{p === "expertise" ? "◆" : p ? "●" : "○"}</span> {s.label} <span className="muted">({s.ability.toUpperCase()})</span> {roll(s.label, skillBonus(ab, s, m.level, p))}</li>;
            })}
          </ul>
        </section>

      {casting && (
        <section className="sheet-card">
          <h4>Spellcasting</h4>
          <p>{ABILITY_NAMES[casting]} · Spell save DC {spellSaveDc(ab, casting, m.level)} · Spell attack {signed(spellAttackBonus(ab, casting, m.level))}</p>
          <ul className="sheet-slots">
            {SPELL_LEVELS.filter((_, i) => (slotsMax[i] ?? 0) > 0).map((l) => {
              const i = l - 1;
              const left = (slotsMax[i] ?? 0) - (slotsUsed[i] ?? 0);
              return (
                <li key={l}>Level {l}: <strong>{left}/{slotsMax[i]}</strong>
                  <button disabled={left <= 0} onClick={() => setUsed(i, (slotsUsed[i] ?? 0) + 1)} aria-label={`Use level ${l} slot`}>Use</button>
                  <button disabled={(slotsUsed[i] ?? 0) <= 0} onClick={() => setUsed(i, (slotsUsed[i] ?? 0) - 1)} aria-label={`Restore level ${l} slot`}>Restore</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="sheet-card sheet-text"><h4>Attacks</h4>
        <ul className="sheet-items">
          {attacks.map((a, i) => (
            <li key={i}>{a.name}
              <Qty label={a.name} value={a.quantity} onChange={(quantity) => patch({ attacks: attacks.map((x, j) => (j === i ? { ...x, quantity } : x)) })} />
              {a.ability ? (
                <label className="qty">Ability of {a.name}
                  <select value={a.ability} onChange={(e) => patch({ attacks: attacks.map((x, j) => (j === i ? { ...x, ability: e.target.value as AttackAbility } : x)) })}>
                    {(Object.keys(ATTACK_ABILITY_LABELS) as AttackAbility[]).map((k) => <option key={k} value={k}>{ATTACK_ABILITY_LABELS[k]}</option>)}
                  </select>
                </label>
              ) : (
                <label className="qty">Attack bonus of {a.name}
                  <input type="number" defaultValue={a.attackBonus ?? 0} key={a.attackBonus ?? 0} aria-label={`Attack bonus of ${a.name}`}
                    onBlur={(e) => { const v = e.target.valueAsNumber || 0; if (v !== (a.attackBonus ?? 0)) patch({ attacks: attacks.map((x, j) => (j === i ? { ...x, attackBonus: v } : x)) }); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                </label>
              )}
              {" "}— {attackToHitText(a, m) && `${attackToHitText(a, m)}, `}{attackDamageText(a, m)}
              <RemoveBtn label={`attack ${a.name}`} onClick={() => patch({ attacks: attacks.filter((_, j) => j !== i) })} />
            </li>
          ))}
        </ul>
        <AddInline label="attack" onAdd={(t) => patch({ attacks: [...attacks, { name: t, ability: "str", proficient: true, count: 0, die: 0, bonus: 0, type: "" }] })} />
        <p className="muted hint">Set damage dice with Edit sheet.</p>
      </section>
      <Items title="Spells" noun="spell" items={m.spells} onChange={(spells) => patch({ spells })} />
      <Items title="Features and traits" noun="trait" items={m.features} generated={m.autoFeatures} onChange={(features) => patch({ features })} />
      <Items title="Proficiencies" noun="proficiency" items={m.proficiencies} generated={m.autoProficiencies} onChange={(proficiencies) => patch({ proficiencies })} />
      <Items title="Languages" noun="language" items={asLanguages(m.languages)} onChange={(languages) => patch({ languages })} />
      <section className="sheet-card sheet-text"><h4>Equipment</h4>
        <ul className="sheet-items">
          {equipment.map((e, i) => (
            isPack(e)
              ? <PackEntry key={i} pack={e} list={srdGear.listId} onRemove={() => patch({ equipment: equipment.filter((_, j) => j !== i) })}
                  onAddItem={(name, n) => setPack(i, [...e.contents!, n > 1 ? { name, quantity: n } : { name }])}
                  onRemoveItem={(k) => setPack(i, e.contents!.filter((_, j) => j !== k))}
                  onChange={(next) => patch({ equipment: equipment.map((x, j) => (j === i ? next : x)) })} />
              : <li key={i}>{e.name}<Qty label={e.name} value={e.quantity} onChange={(quantity) => patch({ equipment: equipment.map((x, j) => (j === i ? { ...x, quantity } : x)) })} /><RemoveBtn label={e.name} onClick={() => patch({ equipment: equipment.filter((_, j) => j !== i) })} /></li>
          ))}
        </ul>
        <AddInline counted list={srdGear.listId} label="item" onAdd={(name, n) => patch({ equipment: [...equipment, newEquipmentEntry(name, n, srdGear.items)] })} extra={{ label: "Add pack", onAdd: (name, n) => patch({ equipment: [...equipment, newEquipmentEntry(name, n, srdGear.items, true)] }) }} />
        {srdGear.datalist}
      </section>
      <section className="sheet-card sheet-text"><h4>Coin</h4><CoinPurse m={m} /></section>
      <Text title="Personality" body={m.personality} />
      <Text title="Backstory" body={m.backstory} />
      <Text title="Notes" body={m.notes} />
      </div>
    </article>
  );
}

/** One party member at the top of the screen: vitals plus the table-speed controls (HP, inspiration). */
function RosterCard({ m, selected, onSelect, onDelete }: { m: PartyMember; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  const [amount, setAmount] = useState("1");
  const hp = currentHpOf(m);
  const pct = m.maxHp > 0 ? Math.round((hp / m.maxHp) * 100) : 0;
  const state = hp <= 0 ? "down" : pct <= 50 ? "bloodied" : "ok";
  const change = (sign: 1 | -1) => {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;
    void updatePartyMember(m.id, { currentHp: applyHpChange(hp, m.maxHp, sign * n) });
  };
  return (
    <li className={`roster-card ${state}${selected ? " selected" : ""}`} aria-label={m.name}>
      <span className="roster-delete"><RemoveBtn label={m.name} onClick={onDelete} /></span>
      <button type="button" className="roster-pick" aria-pressed={selected} onClick={onSelect}>
        <span className="name">{m.name}</span>
        <span className="muted">{[m.race, `${m.class || "Adventurer"} ${m.level}`].filter(Boolean).join(" · ")}</span>
      </button>
      <div className="roster-vitals">
        <span title="Armor Class">AC <strong>{m.ac}</strong></span>
        <span title="Passive Perception">PP <strong>{passivePerceptionOf(m)}</strong></span>
        <span className="roster-hp">HP <strong>{hp}/{m.maxHp}</strong></span>
      </div>
      <div className="hp-bar" role="img" aria-label={`${m.name} health ${pct}%`}><span style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      <div className="roster-hp-controls">
        <input type="number" min={1} value={amount} aria-label={`HP change ${m.name}`} onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); change(-1); } }} />
        <button type="button" className="danger" aria-label={`Damage ${m.name}`} onClick={() => change(-1)}>Damage</button>
        <button type="button" aria-label={`Heal ${m.name}`} onClick={() => change(1)}>Heal</button>
        <button type="button" aria-pressed={!!m.inspiration} aria-label={`Inspiration ${m.name}`} title="Inspiration"
          onClick={() => void updatePartyMember(m.id, { inspiration: !m.inspiration })}>★</button>
      </div>
    </li>
  );
}

function CharacterSheetsPanel({ campaign }: PanelProps) {
  const [members, setMembers] = useState<PartyMember[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const reload = useCallback(async () => setMembers(await listParty(campaign.id)), [campaign.id]);
  const version = useChangeVersion("party");
  useEffect(() => { void reload(); }, [reload, version]);

  if (!members) return null;
  const current = members.find((m) => m.id === selected) ?? members[0];

  const save = async (input: PartyMemberInput) => {
    if (editing === "new") setSelected((await addPartyMember(campaign.id, input)).id);
    else if (editing) await updatePartyMember(editing, input);
    setEditing(null);
    await reload();
  };
  const remove = async (m: PartyMember) => {
    await removePartyMember(m.id);
    setSelected(null);
    await reload();
  };
  if (editing) {
    const initial = editing === "new" ? EMPTY : members.find((m) => m.id === editing);
    if (initial) return <CharacterForm initial={initial} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="sheets">
      <ul className="sheet-roster" aria-label="Party roster">
        {members.map((m) => <RosterCard key={m.id} m={m} selected={current?.id === m.id} onSelect={() => setSelected(m.id)} onDelete={() => void remove(m)} />)}
        <li className="roster-add"><button className="primary" onClick={() => setEditing("new")}>Add character</button></li>
      </ul>
      <div className="sheet-main">
        {!current && <EmptyState>No party members yet. Use “Add character” to create the first sheet.</EmptyState>}
        {current && (
          <>
            <div className="row">
              <button onClick={() => setEditing(current.id)} aria-label={`Edit ${current.name} sheet`}>Edit sheet</button>
            </div>
            <Sheet m={current} />
          </>
        )}
      </div>
    </div>
  );
}

registerPanel({ id: "character-sheets", title: "Character sheets", component: CharacterSheetsPanel });
