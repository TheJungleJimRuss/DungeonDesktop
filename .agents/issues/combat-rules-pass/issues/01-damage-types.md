# 01: Damage types with resistance, immunity and vulnerability

Spec: docs/specs/0008-combat-rules-pass.md (Slice 1). Playtest finding R1.

**What to build:** Damage in `HpControls` gets a damage-type select ("—" default + 13 types). Picking a type adjusts the amount by the target's defenses (immune → 0, resist → half rounded down, then vulnerable → double) before the existing `applyDamage`, and the row shows the reason ("Immune: poison (10 → 0)"). Monsters read defenses from their stat block (SRD or custom). Party members get optional `damageResistances` / `damageImmunities` / `damageVulnerabilities` fields, edited in a "Defenses" fieldset on the Character form and shown as a short line on the sheet and Player card.

**Blocked by:** None (can start immediately)

**Status:** done (2026-11-23)

- [x] `src/combat/damageTypes.ts`: `DAMAGE_TYPES`, `adjustDamage(amount, type, defenses)` with unit tests for every branch (none, resist, immune, vulnerable, both, qualified/unknown strings, odd-number rounding).
- [x] Damage type select in `HpControls` (aria-label "Damage type <name>"), resets to "—" after Damage; Heal ignores it. Reason note with role="status" until the next Damage/Heal on that row.
- [x] Monster defenses via monsterId (SRD + custom); party defenses via partyId; ad-hoc never adjusted.
- [x] Character form "Defenses" fieldset (three checklists), sheet/Player card line hidden when empty. Export/import round-trips the fields.
- [x] App tests: poison on a Ghoul → 0 with note; fire on a fire-resistant party member → half; untyped unchanged. `npx tsc --noEmit` clean.
