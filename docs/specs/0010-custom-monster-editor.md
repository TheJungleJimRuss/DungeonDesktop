# 0010 Custom monster editor: per-item fields

Status: done (2026-11-25)
Source: user request 2026-11-25 ("improve the custom monster entry and make things more per item, not text boxes")

## Goal
The custom monster editor (Custom Entries panel, `src/panels/CustomEntriesPanel.tsx`) stops using free-text boxes for
lists. Every trait, action, save, skill, defense, speed, sense and language is its own control, and the numbers that
follow from the rules (XP, proficiency bonus, save and skill bonuses, Passive Perception) fill themselves in.

## Decisions (from the user, 2026-11-25)
- Traits, Actions, Bonus Actions, Reactions and Legendary Actions: one row per entry, plus an attack builder.
- Saving throws and skills: pick them, and the bonus fills from ability modifier + proficiency bonus (editable).
- Damage and condition defenses: a checkbox per standard type, plus extra rows for qualified entries.
- Also: Size / Type / CR dropdowns with CR filling XP and PB, grouped sections with ability modifiers, speed and sense
  rows, languages as rows.

## Storage: unchanged
The stored record keeps today's SRD `Monster` shape (strings like `"40 ft., Fly 80 ft. (hover)"`, `"DEX +6"`). The
editor parses it into structured form state on open and formats it back on save. No DB version bump, no migration, and
exports stay the same. Anything the parser doesn't recognise goes into an "Other" row, so nothing is lost when a
duplicated SRD monster is opened and saved.

## Form layout (fieldsets, top to bottom)
1. **Basics**: Name; Size (select: Tiny, Small, Medium, Large, Huge, Gargantuan, plus the current value if it is
   something else, such as "Medium or small"); Type (text input with suggestions: the 14 SRD types plus "swarm of tiny
   beasts"); Alignment (text with suggestions).
2. **Challenge**: CR (select 0, 1/8, 1/4, 1/2, 1-30). Picking a CR sets XP and Proficiency bonus from the 2024 tables;
   both stay editable afterwards.
3. **Combat**: AC, AC note, HP, HP dice. Speed: Walk, Burrow, Climb, Fly, Swim (ft. numbers, blank = none), a Hover
   checkbox (enabled when Fly is set) and an Other text field.
4. **Abilities**: six score inputs, each showing its modifier ("+3").
5. **Saving throws**: a checkbox per ability. A checked save shows a bonus that defaults to mod + PB and follows
   changes to the score or PB until the DM types their own number.
6. **Skills**: add a skill from a dropdown (the 18 skills); each row has Proficient / Expertise and a bonus that
   defaults to mod + PB (or mod + 2×PB) and follows changes until hand-edited. Remove button per row.
7. **Senses**: Blindsight, Darkvision, Tremorsense, Truesight (ft.), Other. Passive Perception is shown and saved
   automatically: 10 + Perception bonus if the skill is listed, else 10 + WIS mod.
8. **Languages**: add/remove rows (with suggestions from the SRD language names) and a Telepathy range (ft.).
9. **Defenses**: Vulnerabilities, Resistances, Immunities: a checkbox per the 13 damage types, plus add/remove
   "Other" rows. Condition Immunities: a checkbox per condition (the 15 SRD conditions, Exhaustion included).
(Order changed 2026-11-25 at user request: these sections now follow Abilities, before Saving throws.)
10. **Traits / Actions / Bonus Actions / Reactions / Legendary Actions**: each a list of entry cards (Name input,
    Description textarea, Move up, Move down, Remove) with an "Add trait" / "Add action" / … button. Legendary Actions
    also has a "Uses per round" number (default 3) when it has any entry. Empty-name, empty-description entries are
    dropped on save.

## Attack builder
Each entry card in Actions, Bonus Actions, Reactions and Legendary Actions has a "Build attack" toggle that opens:
- Kind: Melee / Ranged / Melee or Ranged.
- Ability: STR / DEX (default STR for melee, DEX for ranged); Proficient checkbox (on). To-hit = mod + PB, shown and
  overridable.
- Reach (ft., melee) and/or Range normal/long (ft., ranged).
- Damage: dice count, die (d4-d12), bonus (defaults to the ability mod), damage type. Optional second damage line
  ("plus").
- "Write description" replaces the card's description with 2024 stat-block text, for example
  `Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Slashing damage plus 3 (1d6) Fire damage.`
  Average = floor(count × (die + 1) / 2) + bonus. The builder holds no stored state: once written, the text is just the
  description (edit it freely). Opening the builder on existing text does not try to parse it.

## Code shape
- `src/srd/monsterForm.ts` (new, pure, unit-tested): `toMonsterForm(data)` / `fromMonsterForm(form)`, the speed,
  senses, saves, skills, defenses and languages parse/format pairs, `CR_XP` and `crToPb`, and `attackText(spec)`.
  Round-trip test: every SRD monster in `src/data/srd/monsters.json` survives `fromMonsterForm(toMonsterForm(m))`
  with equal speed, senses, saves, skills, defenses and languages (whitespace/order-normalised).
- `src/panels/MonsterEditor.tsx` (new): the monster form; `CustomEntriesPanel.tsx` keeps spells and items and renders
  `MonsterEditor` for monsters.
- Spells and items are unchanged.

## Tests
- `src/srd/monsterForm.test.ts`: parsers, CR table, PB, attack text, SRD round-trip.
- `src/CustomEntries.test.tsx`: updated to the new controls (add an action row instead of typing in a textarea; the
  duplicate test checks the Nimble Escape trait card). New cases: CR select fills XP/PB; checking DEX save shows mod +
  PB; adding Perception updates Passive Perception; a fire resistance checkbox reaches the Stat Block and damage
  adjustment; the attack builder writes the expected description.
- Browser check of the editor at desktop and narrow widths.

## Tickets
1. `monsterForm.ts` with tests (no UI).
2. Monster editor UI: fieldsets, entry cards, saves, skills, senses, speed, languages, defenses, CR auto.
3. Attack builder.

## Out of scope
- Spell and item editors; spellcasting blocks; lair actions; custom monster images.
- Parsing existing attack text back into the builder.
