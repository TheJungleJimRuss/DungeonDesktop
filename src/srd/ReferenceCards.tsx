import { useEffect, useState, type ReactNode } from "react";
import { SRD_CHANGES } from "./attribution";
import StatBlock from "./StatBlock";
import { getReferenceEntry, spellLevelLabel, type RefType, type Condition, type EquipmentItem, type MagicItem, type RefHit, type Spell } from "./reference";
import { Loading } from "../ui/PanelStates";

/** SRD rules text is light Markdown: paragraphs, **bold**, *italic*, "- " bullets and pipe tables. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part.startsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : part);
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s:|-]+\|?$/.test(lines[i])) rows.push(lines[i].replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      i--;
      const [head, ...body] = rows;
      blocks.push(
        <table key={i} className="ref-table"><thead><tr>{head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
          <tbody>{body.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody></table>,
      );
    } else if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) items.push(lines[i++].slice(2));
      i--;
      blocks.push(<ul key={i}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>);
    } else blocks.push(<p key={i}>{inline(line)}</p>);
  }
  return <>{blocks}</>;
}

function Line({ label, value }: { label: string; value?: string | number }) {
  return value === undefined || value === "" ? null : <p className="sb-line"><strong>{label}</strong> {value}</p>;
}

export function SpellView({ s }: { s: Spell }) {
  return (
    <article className="stat-block ref-card" aria-label={`${s.name} spell`}>
      <h3 className="sb-name">{s.name}</h3>
      <p className="sb-sub"><em>{spellLevelLabel(s)}{s.ritual ? " (ritual)" : ""}{s.classes.length ? ` · ${s.classes.join(", ")}` : ""}</em></p>
      <Line label="Casting Time" value={s.castingTime} />
      <Line label="Range" value={s.range} />
      <Line label="Components" value={s.components} />
      <Line label="Duration" value={s.duration} />
      <section className="sb-section" aria-label="Description"><RichText text={s.description} /></section>
      {s.higherLevel && <section className="sb-section" aria-label="Using a Higher-Level Spell Slot"><h3>Using a Higher-Level Spell Slot</h3><RichText text={s.higherLevel} /></section>}
    </article>
  );
}

export function MagicItemView({ m }: { m: MagicItem }) {
  return (
    <article className="stat-block ref-card" aria-label={`${m.name} magic item`}>
      <h3 className="sb-name">{m.name}</h3>
      <p className="sb-sub"><em>{[m.category, m.rarity].filter(Boolean).join(", ")}{m.attunement ? ` (${m.attunement.toLowerCase()})` : ""}</em></p>
      <section className="sb-section" aria-label="Description"><RichText text={m.desc} /></section>
      {m.variants.length > 0 && <Line label="Variants" value={m.variants.join("; ")} />}
    </article>
  );
}

export function EquipmentView({ e }: { e: EquipmentItem }) {
  return (
    <article className="stat-block ref-card" aria-label={`${e.name} equipment`}>
      <h3 className="sb-name">{e.name}</h3>
      <p className="sb-sub"><em>{e.categories.join(", ")}</em></p>
      <Line label="Cost" value={e.cost} />
      <Line label="Weight" value={e.weight ? `${e.weight} lb.` : undefined} />
      <Line label="Armor Class" value={e.armorClass} />
      <Line label="Strength" value={e.strMinimum ? `${e.strMinimum} required` : undefined} />
      <Line label="Stealth" value={e.stealthDisadvantage ? "Disadvantage" : undefined} />
      <Line label="Damage" value={e.damage} />
      <Line label="Range" value={e.range} />
      <Line label="Properties" value={e.properties.join(", ")} />
      <Line label="Mastery" value={e.mastery} />
      <Line label="Contents" value={e.contents?.join(", ")} />
      {e.desc && <section className="sb-section" aria-label="Description"><RichText text={e.desc} /></section>}
    </article>
  );
}

export function ConditionView({ c }: { c: Condition }) {
  return (
    <article className="stat-block ref-card" aria-label={`${c.name} condition`}>
      <h3 className="sb-name">{c.name}</h3>
      <p className="sb-sub"><em>Condition</em></p>
      <section className="sb-section" aria-label="Rules"><RichText text={c.desc} /></section>
    </article>
  );
}

export function ReferenceCard({ hit }: { hit: RefHit }) {
  switch (hit.type) {
    case "monster": return <StatBlock monster={hit.entry} />;
    case "spell": return <SpellView s={hit.entry} />;
    case "magic-item": return <MagicItemView m={hit.entry} />;
    case "equipment": return <EquipmentView e={hit.entry} />;
    case "condition": return <ConditionView c={hit.entry} />;
  }
}

/** The Stat Block panel body for a selected non-monster SRD entry (selection id `ref:<type>:<id>`). */
export function RefSelectionBody({ type, id }: { type: RefType; id: string }) {
  const [hit, setHit] = useState<RefHit | null | undefined>();
  useEffect(() => {
    let live = true;
    setHit(undefined);
    void getReferenceEntry(type, id).then((h) => live && setHit(h ?? null));
    return () => { live = false; };
  }, [type, id]);
  if (hit === undefined) return <Loading />;
  if (hit === null) return <p className="muted">That entry is no longer in the SRD data.</p>;
  return (
    <>
      <ReferenceCard hit={hit} />
      <p className="muted sb-credit">Source: SRD 5.2.1, CC BY 4.0. {SRD_CHANGES}</p>
    </>
  );
}
