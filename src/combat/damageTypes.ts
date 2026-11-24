/** Damage types and the resistance / immunity / vulnerability adjustment (2024 order). Pure; see spec 0008 Slice 1. */
export const DAMAGE_TYPES = [
  "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export interface Defenses { resistances: string[]; immunities: string[]; vulnerabilities: string[] }

/**
 * Adjusts a damage amount for a target's defenses. Immunity makes it 0; otherwise resistance halves (rounded down), then
 * vulnerability doubles. Matching is case-insensitive on the exact type name, so qualified entries never match.
 * `reason` is set only when the amount changed.
 */
export function adjustDamage(amount: number, type: string | undefined, defenses: Defenses): { amount: number; reason?: string } {
  if (!type) return { amount };
  const t = type.trim().toLowerCase();
  const has = (list: string[]) => list.some((x) => x.trim().toLowerCase() === t);
  const immune = has(defenses.immunities), resist = has(defenses.resistances), vuln = has(defenses.vulnerabilities);
  let n = amount, label = "";
  if (immune) { n = 0; label = "Immune"; }
  else if (resist || vuln) {
    if (resist) n = Math.floor(n / 2);
    if (vuln) n *= 2;
    label = resist && vuln ? "Resistant + vulnerable" : resist ? "Resistant" : "Vulnerable";
  }
  return label ? { amount: n, reason: `${label}: ${t} (${amount} → ${n})` } : { amount };
}

/** A Party member's defenses as `adjustDamage` takes them. */
export function memberDefenses(m: { damageResistances?: string[]; damageImmunities?: string[]; damageVulnerabilities?: string[] }): Defenses {
  return { resistances: m.damageResistances ?? [], immunities: m.damageImmunities ?? [], vulnerabilities: m.damageVulnerabilities ?? [] };
}

/** Short Party-sheet line: "Resist poison · Immune fire · Vulnerable radiant"; "" when all three are empty. */
export function defensesLine(m: { damageResistances?: string[]; damageImmunities?: string[]; damageVulnerabilities?: string[] }): string {
  const part = (label: string, l?: string[]) => (l && l.length ? `${label} ${l.map((x) => x.toLowerCase()).join(", ")}` : "");
  return [part("Resist", m.damageResistances), part("Immune", m.damageImmunities), part("Vulnerable", m.damageVulnerabilities)].filter(Boolean).join(" · ");
}
