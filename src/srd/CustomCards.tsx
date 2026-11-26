import type { ItemData, SpellData } from "../storage/customEntries";

/** Card layouts for custom spells and items (SRD spells and items arrive with search ticket 03). */
export function SpellCard({ name, spell: s }: { name: string; spell: SpellData }) {
  const meta = [["Casting Time", s.castingTime], ["Range", s.range], ["Components", s.components], ["Duration", s.duration]] as const;
  return (
    <article className="stat-block" aria-label={`${name} Spell`}>
      <h3 className="sb-name">{name}</h3>
      <p className="sb-sub"><em>{s.level === 0 ? `${s.school} cantrip` : `Level ${s.level} ${s.school}`}{s.ritual ? " (ritual)" : ""}{s.classes?.length ? ` · ${s.classes.join(", ")}` : ""}</em></p>
      {meta.map(([l, v]) => v && <p key={l} className="sb-line"><strong>{l}</strong> {v}</p>)}
      <p className="sb-desc">{s.desc}</p>
      {s.higherLevel && <section className="sb-section" aria-label="Using a Higher-Level Spell Slot"><h3>Using a Higher-Level Spell Slot</h3><p className="sb-desc">{s.higherLevel}</p></section>}
    </article>
  );
}

export function ItemCard({ name, item: i }: { name: string; item: ItemData }) {
  return (
    <article className="stat-block" aria-label={`${name} Item`}>
      <h3 className="sb-name">{name}</h3>
      <p className="sb-sub"><em>{[i.type, i.rarity].filter(Boolean).join(", ")}{i.attunement ? ` (${i.attunement.toLowerCase()})` : ""}</em></p>
      <p className="sb-desc">{i.desc}</p>
    </article>
  );
}
