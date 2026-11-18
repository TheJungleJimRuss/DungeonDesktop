import { useEffect, useState } from "react";
import { loadCharacterData, type Class, type ClassFeature, type NameRef, type Subclass } from "./character";
import type { OpenRef } from "./CharacterCards";
import { Line, RichText } from "./RichText";

export const classSummary = (c: Class) => `Class · d${c.hitDie}`;
export const classFeatureSummary = (f: ClassFeature) =>
  f.subclass ? `${f.subclass.name} (${f.class.name}) · level ${f.level}` : `${f.class.name} feature · level ${f.level}`;
export const subclassSummary = (s: Subclass) => `${s.class.name} subclass`;

function useFeatures(): ClassFeature[] {
  const [features, setFeatures] = useState<ClassFeature[]>([]);
  useEffect(() => {
    let live = true;
    void loadCharacterData().then((c) => live && setFeatures(c.classFeatures));
    return () => { live = false; };
  }, []);
  return features;
}

function Link({ type, r, onOpen, label }: { type: "class" | "subclass" | "class-feature"; r: NameRef; onOpen?: OpenRef; label?: string }) {
  return onOpen ? <button type="button" className="link" onClick={() => onOpen(type, r.id)}>{label ?? r.name}</button> : <>{label ?? r.name}</>;
}

/** One collapsed <details> per feature: its description and a link to the feature's own card. */
function FeatureDetails({ f, onOpen }: { f: ClassFeature; onOpen?: OpenRef }) {
  return (
    <details>
      <summary>{f.name}</summary>
      <RichText text={f.description} />
      {onOpen && <button type="button" className="link" onClick={() => onOpen("class-feature", f.id)}>Open {f.name}</button>}
    </details>
  );
}

function LevelTable({ c, features }: { c: Class; features: ClassFeature[] }) {
  const labels = Object.keys(c.levels[0]?.columns ?? {});
  const name = (id: string) => features.find((f) => f.id === id)?.name ?? id;
  return (
    <div className="level-table-wrap" role="region" aria-label={`${c.name} level table`} tabIndex={0}>
      <table className="level-table">
        <caption>{c.name} features by level</caption>
        <thead><tr>
          <th scope="col">Level</th><th scope="col">Proficiency Bonus</th><th scope="col">Features</th>
          {labels.map((l) => <th key={l} scope="col">{l}</th>)}
        </tr></thead>
        <tbody>
          {c.levels.map((row) => (
            <tr key={row.level}>
              <th scope="row">{row.level}</th><td>+{row.profBonus}</td><td>{row.featureIds.map(name).join(", ") || "—"}</td>
              {labels.map((l) => <td key={l}>{row.columns[l]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClassView({ c, onOpen }: { c: Class; onOpen?: OpenRef }) {
  const features = useFeatures();
  return (
    <article className="stat-block ref-card" aria-label={`${c.name} class`}>
      <h3 className="sb-name">{c.name}</h3>
      <p className="sb-sub"><em>{classSummary(c)}</em></p>
      <Line label="Hit Die" value={`d${c.hitDie}`} />
      <Line label="Primary Ability" value={c.primaryAbility} />
      <Line label="Saving Throws" value={c.savingThrows.join(", ")} />
      <Line label="Proficiencies" value={c.proficiencies.join(", ")} />
      <Line label="Skills" value={c.skillChoices} />
      <Line label="Starting Equipment" value={c.startingEquipment} />
      <Line label="Multiclassing" value={c.multiclass} />
      <LevelTable c={c} features={features} />
      <section className="sb-section" aria-label="Features"><h3>Features</h3>
        {c.levels.filter((l) => l.featureIds.length).map((l) => (
          <div key={l.level}>
            <h4 className="sb-level">Level {l.level}</h4>
            {l.featureIds.map((id) => { const f = features.find((x) => x.id === id); return f && <FeatureDetails key={id} f={f} onOpen={onOpen} />; })}
          </div>
        ))}
      </section>
      {c.subclasses.length > 0 && (
        <p className="sb-line"><strong>Subclasses</strong>{" "}
          {c.subclasses.map((s, i) => <span key={s.id}>{i > 0 && ", "}<Link type="subclass" r={s} onOpen={onOpen} /></span>)}</p>
      )}
    </article>
  );
}

export function SubclassView({ s, onOpen }: { s: Subclass; onOpen?: OpenRef }) {
  const features = useFeatures();
  const levels = [...new Set(s.features.map((f) => f.level))];
  return (
    <article className="stat-block ref-card" aria-label={`${s.name} subclass`}>
      <h3 className="sb-name">{s.name}</h3>
      <p className="sb-sub"><em>{subclassSummary(s)}</em></p>
      <p className="sb-line"><strong>Class</strong> <Link type="class" r={s.class} onOpen={onOpen} /></p>
      <Line label="Summary" value={s.summary} />
      <section className="sb-section" aria-label="Description"><RichText text={s.description} /></section>
      <section className="sb-section" aria-label="Features"><h3>Features</h3>
        {levels.map((lv) => (
          <div key={lv}>
            <h4 className="sb-level">Level {lv}</h4>
            {s.features.filter((f) => f.level === lv).map((r) => { const f = features.find((x) => x.id === r.id); return f && <FeatureDetails key={r.id} f={f} onOpen={onOpen} />; })}
          </div>
        ))}
      </section>
    </article>
  );
}

export function ClassFeatureView({ f, onOpen }: { f: ClassFeature; onOpen?: OpenRef }) {
  return (
    <article className="stat-block ref-card" aria-label={`${f.name} class feature`}>
      <h3 className="sb-name">{f.name}</h3>
      <p className="sb-sub"><em>{classFeatureSummary(f)}</em></p>
      <p className="sb-line"><strong>Class</strong> <Link type="class" r={f.class} onOpen={onOpen} /></p>
      {f.subclass && <p className="sb-line"><strong>Subclass</strong> <Link type="subclass" r={f.subclass} onOpen={onOpen} /></p>}
      <Line label="Level" value={String(f.level)} />
      <section className="sb-section" aria-label="Description"><RichText text={f.description} /></section>
    </article>
  );
}
