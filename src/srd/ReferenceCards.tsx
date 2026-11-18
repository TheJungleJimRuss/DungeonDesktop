import { useEffect, useState } from "react";
import { SRD_CHANGES } from "./attribution";
import StatBlock from "./StatBlock";
import { getReferenceEntry, spellLevelLabel, type RefType, type Condition, type EquipmentItem, type MagicItem, type RefHit, type Spell } from "./reference";
import { Loading } from "../ui/PanelStates";
import { Line, RichText } from "./RichText";
import { BackgroundView, FeatView, RuleView, SpeciesView, SubspeciesView, TraitView, type OpenRef } from "./CharacterCards";
import { ClassFeatureView, ClassView, SubclassView } from "./ClassCards";

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

export function ReferenceCard({ hit, onOpen }: { hit: RefHit; onOpen?: OpenRef }) {
  switch (hit.type) {
    case "monster": return <StatBlock monster={hit.entry} />;
    case "spell": return <SpellView s={hit.entry} />;
    case "magic-item": return <MagicItemView m={hit.entry} />;
    case "equipment": return <EquipmentView e={hit.entry} />;
    case "condition": return <ConditionView c={hit.entry} />;
    case "feat": return <FeatView f={hit.entry} />;
    case "background": return <BackgroundView b={hit.entry} onOpen={onOpen} />;
    case "rule": return <RuleView r={hit.entry} />;
    case "species": return <SpeciesView s={hit.entry} onOpen={onOpen} />;
    case "subspecies": return <SubspeciesView s={hit.entry} onOpen={onOpen} />;
    case "trait": return <TraitView t={hit.entry} onOpen={onOpen} />;
    case "class": return <ClassView c={hit.entry} onOpen={onOpen} />;
    case "subclass": return <SubclassView s={hit.entry} onOpen={onOpen} />;
    case "class-feature": return <ClassFeatureView f={hit.entry} onOpen={onOpen} />;
  }
}

/** The Stat Block panel body for a selected non-monster SRD entry (selection id `ref:<type>:<id>`). */
export function RefSelectionBody({ type, id, onOpen }: { type: RefType; id: string; onOpen?: OpenRef }) {
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
      <ReferenceCard hit={hit} onOpen={onOpen} />
      <p className="muted sb-credit">Source: SRD 5.2.1, CC BY 4.0. {SRD_CHANGES}</p>
    </>
  );
}
