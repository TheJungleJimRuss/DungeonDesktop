import type { Entry, Monster } from "./monsters";
import { crLabel } from "./monsters";
import { RollableText } from "./Rollable";

const ABILITIES = [["str", "STR"], ["dex", "DEX"], ["con", "CON"], ["int", "INT"], ["wis", "WIS"], ["cha", "CHA"]] as const;
const mod = (score: number) => Math.floor((score - 10) / 2);
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

function Section({ title, items, note, rollable }: { title: string; items: Entry[]; note?: string; rollable?: boolean }) {
  if (!items.length) return null;
  return (
    <section className="sb-section" aria-label={title}>
      <h3>{title}</h3>
      {note && <p className="muted"><em>{note}</em></p>}
      {items.map((e) => <p key={e.name}><strong><em>{e.name}.</em></strong> {rollable ? <RollableText text={e.desc} /> : e.desc}</p>)}
    </section>
  );
}

function Line({ label, value }: { label: string; value?: string }) {
  return value ? <p className="sb-line"><strong>{label}</strong> {value}</p> : null;
}

/** A creature's Stat Block in the familiar layout. Used for SRD and (later) custom entries alike. */
export default function StatBlock({ monster: m, rollable }: { monster: Monster; rollable?: boolean }) {
  const xp = m.xpInLair ? `XP ${m.xp.toLocaleString("en-US")}, or ${m.xpInLair.toLocaleString("en-US")} in lair` : `XP ${m.xp.toLocaleString("en-US")}`;
  return (
    <article className="stat-block" aria-label={`${m.name} Stat Block`}>
      <h3 className="sb-name">{m.name}</h3>
      <p className="sb-sub"><em>{m.size} {m.type}, {m.alignment}</em></p>
      <Line label="AC" value={`${m.ac}${m.acNote ? ` (${m.acNote})` : ""}`} />
      <Line label="HP" value={`${m.hp} (${m.hpRoll})`} />
      <Line label="Speed" value={m.speed} />
      <table className="sb-abilities" aria-label="Ability scores">
        <thead><tr>{ABILITIES.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
        <tbody><tr>{ABILITIES.map(([k, l]) => <td key={l} aria-label={l}>{m.abilities[k]} ({signed(mod(m.abilities[k]))})</td>)}</tr></tbody>
      </table>
      <Line label="Saving Throws" value={m.saves.join(", ")} />
      <Line label="Skills" value={m.skills.join(", ")} />
      <Line label="Damage Vulnerabilities" value={m.vulnerabilities.join(", ")} />
      <Line label="Damage Resistances" value={m.resistances.join(", ")} />
      <Line label="Damage Immunities" value={m.immunities.join(", ")} />
      <Line label="Condition Immunities" value={m.conditionImmunities.join(", ")} />
      <Line label="Senses" value={m.senses} />
      <Line label="Languages" value={m.languages} />
      <Line label="Gear" value={m.gear} />
      <Line label="CR" value={`${crLabel(m.cr)} (${xp}; PB ${signed(m.pb)})`} />
      <Section title="Traits" items={m.traits} rollable={rollable} />
      <Section title="Actions" items={m.actions} rollable={rollable} />
      <Section title="Bonus Actions" items={m.bonusActions} rollable={rollable} />
      <Section title="Reactions" items={m.reactions} rollable={rollable} />
      <Section title="Legendary Actions" items={m.legendaryActions} rollable={rollable}
        note={m.legendaryUses ? `Legendary Action Uses: ${m.legendaryUses} (${m.legendaryUses + 1} in Lair). Immediately after another creature's turn, the creature can expend a use to take one of the following actions. It regains all expended uses at the start of each of its turns.` : undefined} />
      <Section title="Lair Actions" items={m.lairActions ?? []} />
    </article>
  );
}
