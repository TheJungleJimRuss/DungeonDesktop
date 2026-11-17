import { useCallback, useEffect, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { useChangeVersion } from "../sync/changeBus";
import { asLanguages, currentHpOf, listParty, updatePartyMember, type PartyMember } from "../storage/party";
import { passivePerceptionOf } from "../party/passive";
import {
  ABILITIES, ABILITY_NAMES, CURRENCIES, DEFAULT_ABILITIES, NO_COINS, SKILLS, SPELL_LEVELS, abilityMod, applyHpChange, asAttacks, asEquipment,
  attackDamageText, attackLabel, countLabel, isPack, saveBonus, signed, skillBonus, spellAttackBonus, spellSaveDc, type SkillLevel,
} from "../party/sheet";

/** 10 + skill modifier; null when the member has no sheet abilities to work from. */
function passiveSkill(m: PartyMember, key: string): number | null {
  if (!m.abilities) return null;
  const skill = SKILLS.find((s) => s.key === key)!;
  return 10 + skillBonus({ ...DEFAULT_ABILITIES, ...m.abilities }, skill, m.level, m.skills?.[key]);
}

/** Fraction of max HP left, 0-100. */
function hpPercent(m: PartyMember): number {
  return m.maxHp > 0 ? Math.max(0, Math.min(100, (currentHpOf(m) / m.maxHp) * 100)) : 0;
}

const TABS = ["Overview", "Abilities", "Skills", "Gear", "Spells", "Story"] as const;
type Tab = (typeof TABS)[number];

const NEXT_PROF: Record<string, SkillLevel | undefined> = { none: "proficient", proficient: "expertise", expertise: undefined };

/** A textarea that saves when the DM clicks away. */
function EditableText({ label, value, onSave }: { label: string; value?: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  return (
    <label className="player-text"><span className="muted">{label}</span>
      <textarea rows={3} value={text} aria-label={label} onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== (value ?? "")) onSave(text); }} />
    </label>
  );
}

function Overview({ m }: { m: PartyMember }) {
  const [amount, setAmount] = useState("1");
  const hp = currentHpOf(m);
  const insight = passiveSkill(m, "insight");
  const investigation = passiveSkill(m, "investigation");
  const change = (sign: 1 | -1) => {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;
    void updatePartyMember(m.id, { currentHp: applyHpChange(hp, m.maxHp, sign * n) });
  };
  const languages = asLanguages(m.languages).join(", ");
  return (
    <>
      <div className="party-stats">
        <span>AC {m.ac}</span>
        <span>HP {hp}/{m.maxHp}</span>
        <span>Passive Perception {passivePerceptionOf(m)}</span>
        {insight !== null && <span>Passive Insight {insight}</span>}
        {investigation !== null && <span>Passive Investigation {investigation}</span>}
      </div>
      <div className="roster-hp-controls">
        <input type="number" min={1} value={amount} aria-label={`HP change ${m.name}`} onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); change(-1); } }} />
        <button type="button" className="danger" aria-label={`Damage ${m.name}`} onClick={() => change(-1)}>Damage</button>
        <button type="button" aria-label={`Heal ${m.name}`} onClick={() => change(1)}>Heal</button>
        <button type="button" aria-pressed={!!m.inspiration} aria-label={`Inspiration ${m.name}`} title="Inspiration"
          onClick={() => void updatePartyMember(m.id, { inspiration: !m.inspiration })}>★ Inspiration</button>
      </div>
      <dl>
        {([["Languages", languages], ["Speed", m.speed], ["Personality", m.personality], ["Notes", m.notes]] as [string, string | undefined][])
          .filter(([, v]) => v?.trim()).map(([k, v]) => <div key={k}><dt className="muted">{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </>
  );
}

function Abilities({ m }: { m: PartyMember }) {
  const ab = { ...DEFAULT_ABILITIES, ...m.abilities };
  return (
    <div className="sheet-abilities">
      {ABILITIES.map((a) => {
        const prof = (m.saveProficiencies ?? []).includes(a);
        return (
          <div key={a} className="ability" aria-label={ABILITY_NAMES[a]}>
            <span className="muted">{a.toUpperCase()}</span>
            <strong>{ab[a]}</strong>
            <span className="bonus" aria-label={`${ABILITY_NAMES[a]} check`}>{signed(abilityMod(ab[a]))}</span>
            <span className="muted" aria-label={`${ABILITY_NAMES[a]} save`}>{prof ? "●" : "○"} save {signed(saveBonus(ab, a, m.level, prof))}</span>
          </div>
        );
      })}
    </div>
  );
}

function Skills({ m }: { m: PartyMember }) {
  const ab = { ...DEFAULT_ABILITIES, ...m.abilities };
  const cycle = (key: string) => {
    const next = NEXT_PROF[m.skills?.[key] ?? "none"];
    void updatePartyMember(m.id, { skills: { ...m.skills, [key]: next } });
  };
  return (
    <>
      <p className="muted hint">Click a skill to cycle: none, proficient, expertise.</p>
      <ul className="sheet-list">
        {SKILLS.map((s) => {
          const p = m.skills?.[s.key];
          return (
            <li key={s.key}>
              <button type="button" className="skill-toggle" aria-label={`${s.label} ${p ?? "untrained"}`} onClick={() => cycle(s.key)}>
                <span aria-hidden>{p === "expertise" ? "◆" : p ? "●" : "○"}</span> {s.label} <span className="muted">({s.ability.toUpperCase()})</span>{" "}
                <span className="bonus">{signed(skillBonus(ab, s, m.level, p))}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Gear({ m }: { m: PartyMember }) {
  const attacks = asAttacks(m.attacks);
  const equipment = asEquipment(m.equipment);
  const coins = { ...NO_COINS, ...m.coins };
  return (
    <>
      <section><h4>Attacks</h4>
        {attacks.length === 0 ? <p className="muted">None.</p>
          : <ul className="sheet-items">{attacks.map((a, i) => <li key={i}>{attackLabel(a)} — {attackDamageText(a)}</li>)}</ul>}
      </section>
      <section><h4>Equipment</h4>
        {equipment.length === 0 ? <p className="muted">None.</p>
          : <ul className="sheet-items">{equipment.map((e, i) => (
            <li key={i}>{countLabel(e)}{isPack(e) && e.contents!.length > 0 && <span className="muted"> ({e.contents!.map(countLabel).join(", ")})</span>}</li>
          ))}</ul>}
      </section>
      <section><h4>Coin</h4>
        <div className="player-coins">
          {CURRENCIES.map((c) => (
            <label key={c}><span className="muted">{c}</span>
              <input type="number" min={0} aria-label={`${c} ${m.name}`} defaultValue={coins[c]} key={`${c}-${coins[c]}`}
                onBlur={(e) => {
                  const n = Math.max(0, Math.floor(Number(e.target.value)) || 0);
                  if (n !== coins[c]) void updatePartyMember(m.id, { coins: { ...coins, [c]: n } });
                }} />
            </label>
          ))}
        </div>
      </section>
    </>
  );
}

function Spells({ m }: { m: PartyMember }) {
  const ab = { ...DEFAULT_ABILITIES, ...m.abilities };
  const casting = m.spellcastingAbility;
  const slotsMax = m.spellSlotsMax ?? [];
  const slotsUsed = m.spellSlotsUsed ?? [];
  const setUsed = (i: number, used: number) => {
    const next = SPELL_LEVELS.map((_, j) => slotsUsed[j] ?? 0);
    next[i] = Math.max(0, Math.min(slotsMax[i] ?? 0, used));
    void updatePartyMember(m.id, { spellSlotsUsed: next });
  };
  if (!casting && !m.spells?.trim()) return <p className="muted">Not a spellcaster.</p>;
  return (
    <>
      {casting && <p>{ABILITY_NAMES[casting]} · Spell save DC {spellSaveDc(ab, casting, m.level)} · Spell attack {signed(spellAttackBonus(ab, casting, m.level))}</p>}
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
      <EditableText label="Spells" value={m.spells} onSave={(spells) => void updatePartyMember(m.id, { spells })} />
    </>
  );
}

function Story({ m }: { m: PartyMember }) {
  const save = (p: Partial<PartyMember>) => void updatePartyMember(m.id, p);
  return (
    <>
      <EditableText label="Personality" value={m.personality} onSave={(personality) => save({ personality })} />
      <EditableText label="Backstory" value={m.backstory} onSave={(backstory) => save({ backstory })} />
      <EditableText label="Notes" value={m.notes} onSave={(notes) => save({ notes })} />
    </>
  );
}

function PlayerCard({ m }: { m: PartyMember }) {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <article className="player-card npc-view" aria-label={`${m.name} player card`}>
      <h3>{m.name}</h3>
      <p className="muted">
        {[m.race, `${m.class || "Adventurer"} ${m.level}`, m.background].filter(Boolean).join(" · ")}
        {m.playerName ? ` · played by ${m.playerName}` : ""}
      </p>
      <div className="player-tabs" role="group" aria-label="Player card sections">
        {TABS.map((t) => <button key={t} type="button" aria-pressed={t === tab} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === "Overview" && <Overview m={m} />}
      {tab === "Abilities" && <Abilities m={m} />}
      {tab === "Skills" && <Skills m={m} />}
      {tab === "Gear" && <Gear m={m} />}
      {tab === "Spells" && <Spells m={m} />}
      {tab === "Story" && <Story m={m} />}
    </article>
  );
}

/** Pick a player character and see what matters while roleplaying with them. */
function PlayerCardPanel({ campaign }: PanelProps) {
  const [members, setMembers] = useState<PartyMember[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const reload = useCallback(async () => setMembers(await listParty(campaign.id)), [campaign.id]);
  const version = useChangeVersion("party");
  useEffect(() => { void reload(); }, [reload, version]);

  if (!members) return <p className="muted">Loading...</p>;
  if (members.length === 0) return <p className="muted">No player characters yet. Add them in Party mode.</p>;
  const current = members.find((m) => m.id === selected) ?? members[0];
  return (
    <div className="npc-list">
      <div className="player-picker" role="group" aria-label="Player characters">
        {members.map((m) => (
          <button key={m.id} aria-pressed={m.id === current.id} onClick={() => setSelected(m.id)}>
            {m.name}
            <span className={`hp-bar player-hp ${hpPercent(m) > 50 ? "ok" : hpPercent(m) > 25 ? "bloodied" : "down"}`} aria-hidden="true">
              <span style={{ width: `${hpPercent(m)}%` }} />
            </span>
          </button>
        ))}
      </div>
      <PlayerCard m={current} />
    </div>
  );
}

export default registerPanel({ id: "player-card", title: "Player card", component: PlayerCardPanel });
