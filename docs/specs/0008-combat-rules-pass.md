# 0008 Combat rules pass: damage types and encounter difficulty

Status: done (2026-11-23)
Source: playtest findings R1 and R2 (docs/playtests/2026-11-23-mock-playthrough.md)

## Goal
1. **R1:** Damage can carry a damage type. When the target resists, is immune to, or is vulnerable to that type, the
   amount is adjusted automatically and the row says why.
2. **R2:** The Initiative tracker shows the encounter's 2024 difficulty (Low, Moderate or High) against the XP budget,
   and updates as monsters come and go.

## Decisions (from the user, 2026-11-23)
- Resistances come from monster stat blocks (SRD and custom) **and** a new field on Party sheets.
- Auto-adjust and show why, e.g. "Immune: poison (10 → 0)". The type defaults to none, so untyped damage behaves as it
  does today.
- The difficulty budget uses the party combatants in the Encounter. With none added yet (prep), it uses every Party
  member's level.
- The readout is shown in the Initiative tracker only. It is not added to Saved Encounters.

## Slice 1: damage types (R1)

### Rules (pure, `src/combat/damageTypes.ts`)
- The 13 types are Acid, Bludgeoning, Cold, Fire, Force, Lightning, Necrotic, Piercing, Poison, Psychic, Radiant,
  Slashing and Thunder.
- `adjustDamage(amount, type, defenses)` returns `{ amount, reason? }`. Defenses are `{ resistances, immunities,
  vulnerabilities }`, each a string array.
  - No type: the amount is unchanged.
  - Immunity: the amount becomes 0.
  - Otherwise resistance halves (rounded down), then vulnerability doubles (2024 order). Having both gives
    floor(n/2)×2.
  - Matching is case-insensitive on the exact type name. Qualified SRD entries (2 monsters, e.g. "Piercing damage from
    weapons wielded by creatures under … bless") never match, so they leave the amount unchanged.
  - `reason` reads "Resistant: fire (10 → 5)", "Immune: poison (10 → 0)", "Vulnerable: radiant (7 → 14)" or
    "Resistant + vulnerable: …".
- The adjustment happens before temporary HP. The adjusted amount then goes through the existing `applyDamage`, so
  Dying, death-save failures, concentration-check DCs and Defeated all work as they do now.

### Where defenses come from
- `monsterId` (SRD or `custom:`): the monster's `resistances`, `immunities` and `vulnerabilities` (the same lookup
  "Roll HP" already uses).
- `partyId`: new optional PartyMember fields `damageResistances`, `damageImmunities` and `damageVulnerabilities`
  (string[]).
  - On the Character form they are edited as three multi-select checklists of the 13 types, in a "Defenses"
    fieldset.
  - The sheet view and the Player card show them as a short line ("Resist poison"). The line is hidden when all three
    are empty.
  - Not auto-filled from species. (A Dwarf's Dwarven Resilience is a manual tick for now; auto-fill could be a later
    item.)
- Ad-hoc combatants: no defenses, so the amount is never adjusted.

### UI (`HpControls`)
- A "Type" select (no label text beyond its aria-label "Damage type <name>"), next to the amount, with "—" as the
  default plus the 13 types. It only affects Damage; Heal ignores it.
- After an adjusted hit, the row shows the reason as a small note (`role="status"`). It stays until the next
  Damage/Heal on that row.
- The type resets to "—" after each Damage, the same way the amount box clears.
- The Player card's HP controls get the same select, since they reuse `HpControls`.

## Slice 2: encounter difficulty (R2)

### Rules (pure, `src/combat/difficulty.ts`)
- `XP_BUDGET[level] = { low, moderate, high }`, per character, levels 1–20 (2024 DMG table, numbers only; levels above
  20 are treated as 20 and levels below 1 as 1).
- `encounterDifficulty(levels: number[], monsterXp: number[])` returns
  `{ total, budget: { low, moderate, high }, band }`.
  - `band` is "Below Low", "Low", "Moderate", "High" or "Above High". The total is compared with the summed budgets:
    total < low is "Below Low", low ≤ total < moderate is "Low", and so on. It is "Above High" when total > high.
  - There is no group-size multiplier (2024 rules).
- Monster XP comes from the stat block's `xp` (SRD or custom). Ad-hoc combatants and monsters without XP count as 0,
  and the readout says how many were not counted ("2 without XP not counted").
- Defeated monsters still count: it is the encounter's difficulty, not what is left of it.

### UI (Initiative tracker)
- A line under the add area: **"Moderate · 300 XP"**, then muted "Low 150 · Moderate 225 · High 400 for 1 character
  (level 3)". With several levels it reads "for 4 characters".
- Hidden when there are no monsters, or when there are no party members at all (no budget to compare against).
- When there are no party combatants in the Encounter, the basis is the whole Party, labelled "(whole party)".

## Out of scope
- Saved Encounters difficulty, damage-type auto-fill from attacks or species traits, condition immunities blocking
  conditions, magical/nonmagical qualifiers, and Undo (U3).

## Tests
- Unit: `adjustDamage` covers every branch (none, resist, immune, vulnerable, both, unknown or qualified string,
  rounding of odd amounts). `encounterDifficulty` covers each band boundary, level clamping, mixed levels and zero XP.
- App (Vitest + in-memory IndexedDB):
  - Poison on a Ghoul leaves its HP unchanged and shows "Immune: poison (10 → 0)".
  - Fire on a party member with fire resistance takes half.
  - Untyped damage is unchanged.
  - The difficulty line updates when a monster is added and removed.
  - It falls back to the whole party when no party combatants are in the Encounter.
- Export/import round-trips the new PartyMember fields (no DB version bump; they are optional fields on an existing
  store).
