import { useEffect, useState } from "react";
import { RULE_KIND_LABELS, loadCharacterData, type Background, type Feat, type NameRef, type Rule, type Species, type Subspecies, type Trait } from "./character";
import type { RefType } from "./reference";
import { Line, RichText } from "./RichText";

/** Opens another SRD entry as the selection (the same as clicking a search result). */
export type OpenRef = (type: RefType, id: string) => void;

export function featSummary(f: Feat) { return `${f.category} feat`; }

export function FeatView({ f }: { f: Feat }) {
  return (
    <article className="stat-block ref-card" aria-label={`${f.name} feat`}>
      <h3 className="sb-name">{f.name}</h3>
      <p className="sb-sub"><em>{featSummary(f)}</em></p>
      <Line label="Prerequisite" value={f.prerequisite} />
      <section className="sb-section" aria-label="Description"><RichText text={f.description} /></section>
      <Line label="Repeatable" value={f.repeatable} />
    </article>
  );
}

export function BackgroundView({ b, onOpen }: { b: Background; onOpen?: OpenRef }) {
  return (
    <article className="stat-block ref-card" aria-label={`${b.name} background`}>
      <h3 className="sb-name">{b.name}</h3>
      <p className="sb-sub"><em>Background{b.source ? ` (${b.source}, not in SRD 5.2.1)` : ""}</em></p>
      <Line label="Ability Scores" value={b.abilityScores.join(", ")} />
      <p className="sb-line"><strong>Feat</strong>{" "}
        {onOpen && b.feat.id ? <button type="button" className="link" onClick={() => onOpen("feat", b.feat.id)}>{b.feat.name}</button> : b.feat.name}</p>
      <Line label="Skill Proficiencies" value={b.skills.join(", ")} />
      <Line label="Tool Proficiencies" value={b.tools.join(", ")} />
      {b.proficiencyChoices?.map((c) => <Line key={c} label="Choice" value={c} />)}
      {b.equipment.length > 0 && (
        <section className="sb-section" aria-label="Equipment"><h3>Equipment</h3>{b.equipment.map((e) => <p key={e}>{e}</p>)}</section>
      )}
    </article>
  );
}

export function ruleSummary(r: Rule) { return RULE_KIND_LABELS[r.kind]; }

export function RuleView({ r }: { r: Rule }) {
  return (
    <article className="stat-block ref-card" aria-label={`${r.name} ${RULE_KIND_LABELS[r.kind].toLowerCase()}`}>
      <h3 className="sb-name">{r.name}{r.abbreviation ? ` (${r.abbreviation})` : ""}</h3>
      <p className="sb-sub"><em>{RULE_KIND_LABELS[r.kind]}</em></p>
      <Line label="Ability" value={r.ability} />
      <Line label="Availability" value={r.kind === "language" ? (r.rare ? "Rare" : "Standard") : undefined} />
      <Line label="Skills" value={r.skills?.join(", ")} />
      <Line label="Note" value={r.note} />
      {r.desc && <section className="sb-section" aria-label="Description"><RichText text={r.desc} /></section>}
    </article>
  );
}

export const speciesSummary = (s: Species) => `Species · ${s.size}`;
export const subspeciesSummary = (s: Subspecies) => `${s.species.name} subspecies`;
export const traitSummary = (t: Trait) => `${t.species[0]?.name ?? "Species"} trait`;

function Links({ label, type, refs, onOpen }: { label: string; type: "species" | "subspecies" | "trait"; refs: NameRef[]; onOpen?: OpenRef }) {
  if (!refs.length) return null;
  return (
    <p className="sb-line"><strong>{label}</strong>{" "}
      {refs.map((r, i) => (
        <span key={r.id}>{i > 0 && ", "}{onOpen ? <button type="button" className="link" onClick={() => onOpen(type, r.id)}>{r.name}</button> : r.name}</span>
      ))}
    </p>
  );
}

/** Each trait as a collapsed <details> with its description (resolved from the character data). */
function TraitList({ refs, onOpen }: { refs: NameRef[]; onOpen?: OpenRef }) {
  const [traits, setTraits] = useState<Trait[]>([]);
  useEffect(() => {
    let live = true;
    void loadCharacterData().then((c) => live && setTraits(c.traits));
    return () => { live = false; };
  }, []);
  if (!refs.length) return null;
  return (
    <section className="sb-section" aria-label="Traits"><h3>Traits</h3>
      {refs.map((r) => {
        const t = traits.find((x) => x.id === r.id);
        return (
          <details key={r.id}>
            <summary>{r.name}</summary>
            {t && <RichText text={t.description} />}
            {onOpen && <button type="button" className="link" onClick={() => onOpen("trait", r.id)}>Open {r.name}</button>}
          </details>
        );
      })}
    </section>
  );
}

export function SpeciesView({ s, onOpen }: { s: Species; onOpen?: OpenRef }) {
  return (
    <article className="stat-block ref-card" aria-label={`${s.name} species`}>
      <h3 className="sb-name">{s.name}</h3>
      <p className="sb-sub"><em>{speciesSummary(s)}</em></p>
      <Line label="Creature Type" value={s.type} />
      <Line label="Size" value={s.size} />
      <Line label="Speed" value={`${s.speed} ft.`} />
      <TraitList refs={s.traits} onOpen={onOpen} />
      <Links label="Subspecies" type="subspecies" refs={s.subspecies} onOpen={onOpen} />
    </article>
  );
}

export function SubspeciesView({ s, onOpen }: { s: Subspecies; onOpen?: OpenRef }) {
  return (
    <article className="stat-block ref-card" aria-label={`${s.name} subspecies`}>
      <h3 className="sb-name">{s.name}</h3>
      <p className="sb-sub"><em>{subspeciesSummary(s)}</em></p>
      <Links label="Species" type="species" refs={[s.species]} onOpen={onOpen} />
      <Line label="Damage Type" value={s.damageType} />
      <TraitList refs={s.traits} onOpen={onOpen} />
    </article>
  );
}

export function TraitView({ t, onOpen }: { t: Trait; onOpen?: OpenRef }) {
  return (
    <article className="stat-block ref-card" aria-label={`${t.name} trait`}>
      <h3 className="sb-name">{t.name}</h3>
      <p className="sb-sub"><em>{traitSummary(t)}</em></p>
      <Links label="Species" type="species" refs={t.species} onOpen={onOpen} />
      <Links label="Subspecies" type="subspecies" refs={t.subspecies ?? []} onOpen={onOpen} />
      <section className="sb-section" aria-label="Description"><RichText text={t.description} /></section>
    </article>
  );
}
