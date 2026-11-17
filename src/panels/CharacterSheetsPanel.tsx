import { useCallback, useEffect, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { useChangeVersion } from "../sync/changeBus";
import { addPartyMember, asList, currentHpOf, listParty, removePartyMember, updatePartyMember, type PartyMember, type PartyMemberInput } from "../storage/party";
import { requestRoll } from "../dice/roller";
import CharacterForm from "./CharacterForm";
import {
  ABILITIES, ABILITY_NAMES, CURRENCIES, asAttacks, asEquipment, isPack, attackDamageText, attackExpression, attackLabel, DEFAULT_ABILITIES, SKILLS, SPELL_LEVELS,
  abilityMod, proficiencyBonus, saveBonus, signed, skillBonus, spellAttackBonus, spellSaveDc,
} from "../party/sheet";

const EMPTY: PartyMemberInput = { name: "", class: "", level: 1, ac: 10, maxHp: 1, passivePerception: 10, notes: "" };

function Text({ title, body }: { title: string; body?: string }) {
  if (!body?.trim()) return null;
  return <section className="sheet-text"><h4>{title}</h4><p>{body}</p></section>;
}

function Items({ title, items }: { title: string; items?: string[] | string }) {
  const list = asList(items);
  if (!list.length) return null;
  return <section className="sheet-text"><h4>{title}</h4><ul className="sheet-items">{list.map((x, i) => <li key={i}>{x}</li>)}</ul></section>;
}

function Sheet({ m, onRoll }: { m: PartyMember; onRoll: (label: string, expression: string) => void }) {
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
  const coins = m.coins;
  const hasCoins = coins && CURRENCIES.some((c) => coins[c] > 0);
  const roll = (label: string, bonus: number) => (
    <button className="roll" onClick={() => onRoll(label, `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`)} aria-label={`Roll ${label}`}>{signed(bonus)}</button>
  );

  return (
    <article className="sheet" aria-label={`${m.name} character sheet`}>
      <header>
        <h3>{m.name}</h3>
        <p className="muted">
          {[m.race, `${m.class || "Adventurer"} ${m.level}`, m.background, m.alignment].filter(Boolean).join(" · ")}
          {m.playerName ? ` · played by ${m.playerName}` : ""}{m.xp !== undefined ? ` · ${m.xp} XP` : ""}
        </p>
      </header>
      <dl className="sheet-vitals">
        <div><dt>AC</dt><dd>{m.ac}</dd></div>
        <div><dt>HP</dt><dd>{currentHpOf(m)}/{m.maxHp}</dd></div>
        <div><dt>Initiative</dt><dd>{roll("Initiative", abilityMod(ab.dex))}</dd></div>
        <div><dt>Speed</dt><dd>{m.speed || "—"}</dd></div>
        <div><dt>Proficiency</dt><dd>{signed(pb)}</dd></div>
        <div><dt>Passive Perception</dt><dd>{m.passivePerception}</dd></div>
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

      <div className="sheet-cols">
        <section>
          <h4>Saving throws</h4>
          <ul className="sheet-list">
            {ABILITIES.map((a) => {
              const prof = (m.saveProficiencies ?? []).includes(a);
              return <li key={a}><span aria-hidden>{prof ? "●" : "○"}</span> {ABILITY_NAMES[a]} {roll(`${ABILITY_NAMES[a]} save`, saveBonus(ab, a, m.level, prof))}</li>;
            })}
          </ul>
        </section>
        <section>
          <h4>Skills</h4>
          <ul className="sheet-list">
            {SKILLS.map((s) => {
              const p = m.skills?.[s.key];
              return <li key={s.key}><span aria-hidden>{p === "expertise" ? "◆" : p ? "●" : "○"}</span> {s.label} <span className="muted">({s.ability.toUpperCase()})</span> {roll(s.label, skillBonus(ab, s, m.level, p))}</li>;
            })}
          </ul>
        </section>
      </div>

      {casting && (
        <section>
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

      {asAttacks(m.attacks).length > 0 && (
        <section className="sheet-text"><h4>Attacks</h4>
          <ul className="sheet-items">
            {asAttacks(m.attacks).map((a, i) => (
              <li key={i}>{attackLabel(a)} — {attackDamageText(a)}{" "}
                {attackExpression(a) && <button className="roll" aria-label={`Roll ${a.name} damage`} onClick={() => onRoll(`${a.name} damage`, attackExpression(a)!)}>Roll</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Text title="Spells" body={m.spells} />
      <Items title="Features and traits" items={m.features} />
      <Items title="Proficiencies" items={m.proficiencies} />
      <Text title="Languages" body={m.languages} />
      {asEquipment(m.equipment).length > 0 && (
        <section className="sheet-text"><h4>Equipment</h4>
          <ul className="sheet-items">
            {asEquipment(m.equipment).map((e, i) => (
              <li key={i}>{e.name}
                {isPack(e) && (e.contents!.length
                  ? <ul aria-label={`${e.name} contents`}>{e.contents!.map((c, k) => <li key={k}>{c}</li>)}</ul>
                  : <span className="muted"> (empty pack)</span>)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {hasCoins && <p><strong>Coin:</strong> {CURRENCIES.filter((c) => coins![c] > 0).map((c) => `${coins![c]} ${c}`).join(", ")}</p>}
      <Text title="Personality" body={m.personality} />
      <Text title="Backstory" body={m.backstory} />
      <Text title="Notes" body={m.notes} />
    </article>
  );
}

function CharacterSheetsPanel({ campaign }: PanelProps) {
  const [members, setMembers] = useState<PartyMember[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [lastRoll, setLastRoll] = useState("");

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
  const onRoll = (label: string, expression: string) => {
    const r = requestRoll(expression);
    if (r.ok) setLastRoll(`${current?.name} ${label}: ${r.total}`);
  };

  if (editing) {
    const initial = editing === "new" ? EMPTY : members.find((m) => m.id === editing);
    if (initial) return <CharacterForm initial={initial} onSave={save} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="sheets">
      <nav className="sheet-roster" aria-label="Party roster">
        {members.map((m) => (
          <button key={m.id} aria-pressed={current?.id === m.id} onClick={() => setSelected(m.id)}>
            <span className="name">{m.name}</span>
            <span className="muted">{m.class} {m.level} · HP {currentHpOf(m)}/{m.maxHp}</span>
          </button>
        ))}
        <button className="primary" onClick={() => setEditing("new")}>Add character</button>
      </nav>
      <div className="sheet-main">
        {!current && <p className="muted">No party members yet. Use “Add character” to create the first sheet.</p>}
        {current && (
          <>
            <div className="row">
              <button onClick={() => setEditing(current.id)} aria-label={`Edit ${current.name} sheet`}>Edit sheet</button>
              <button className="danger" onClick={() => remove(current)} aria-label={`Delete ${current.name}`}>Delete</button>
              {lastRoll && <output className="muted" aria-label="Last roll">{lastRoll}</output>}
            </div>
            <Sheet m={current} onRoll={onRoll} />
          </>
        )}
      </div>
    </div>
  );
}

registerPanel({ id: "character-sheets", title: "Character sheets", component: CharacterSheetsPanel });
