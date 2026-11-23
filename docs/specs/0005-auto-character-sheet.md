Status: built (2026-11-23), slices 1-5 done. Local file; no tracker configured.

# Player card in Combat and an auto-filled character sheet

## Problem Statement

In Combat the DM can't see a PC's sheet without switching Mode. And the sheet is mostly typed by hand: attack to-hit bonuses, saves, hit dice, spell slots, max HP and features all have to be looked up and kept current at every level-up, even though the bundled SRD already holds the class tables.

## Solution

1. **Player card in Combat.** Same panel as Explore/Roleplay (picker only, no turn following). Combat layout becomes: Battle Map (cols 1-6, rows 1-2), Initiative (7-12, row 1), Stat Block (7-9, row 2), Player card (10-12, row 2), Dice roller (7-12, row 3).
2. **Class, Background and Species become dropdowns** (SRD entries plus **Custom…**, which reveals a text box). Old records whose text matches an SRD name (case-insensitive) read as that entry; anything else reads as Custom with the old text.
3. **Auto fields follow class + level + species + abilities, and stay overridable.** When a field is auto it shows its computed value with an "auto" tag; typing a value marks it manual (stored in `manual`), and a "Reset to auto" button clears it. Custom class = every class-driven field manual, as today. Values are recomputed and written into the record on save (and on a level change), so every existing reader (Combat, passive scores, export) keeps reading plain fields.

| Field | Auto value |
|---|---|
| Proficiency bonus | From level (already automatic); shown on the card |
| Saving throw proficiencies | Class saving throws |
| Hit Dice | `<level>d<hitDie>` |
| Max HP | Level 1: hit die max + CON mod; each later level: die average (d6 4, d8 5, d10 6, d12 7) + CON mod; min 1 per level |
| Spellcasting ability | Bard/Paladin/Sorcerer/Warlock CHA, Cleric/Druid/Ranger WIS, Wizard INT; others none |
| Spell slots 1-9 | Class level table columns (Warlock pact slots included) |
| Speed | Species speed, e.g. "30 ft." |
| Armor/weapon proficiencies | Class proficiencies + background tool |
| Skill proficiencies | Background's 2 skills marked proficient (never downgrades expertise) |
| Features | Class features up to current level, background origin feat, species traits |

Generated list entries (features, proficiencies) are kept apart from the DM's own entries, so a level change regenerates them without touching hand-added items. Class skill choices and background ability bumps stay manual.

4. **Attack bonus is automatic.** Each attack gets an ability (STR, DEX, Finesse = better of the two, or Spell = spellcasting ability), a Proficient tick (on by default) and an optional magic bonus. To-hit = ability mod + proficiency bonus (if proficient) + magic. Damage = dice + ability mod + magic + the existing flat bonus. Old attacks with a typed attack bonus and no ability keep their number until edited. The Player card's Gear tab shows to-hit and damage for every attack.

5. **Level follows XP** (added 2026-11-23). Level is an auto field from XP using the 5e thresholds (0, 300, 900, 2,700, 6,500, 14,000, 23,000, 34,000, 48,000, 64,000, 85,000, 100,000, 120,000, 140,000, 165,000, 195,000, 225,000, 265,000, 305,000, 355,000 for levels 1-20); typing a level marks it manual (milestone play), "Reset to auto" returns to XP. A member with no XP keeps its typed level. The Player card gets an **Award XP** box; ending an Encounter offers **Award XP to party**, pre-filled with the defeated monsters' XP, split evenly (rounded down) among the Party combatants. Any level change from XP re-runs the auto fields, so HP, slots and features follow.

## Data changes (PartyMember, all optional)

`classId`, `backgroundId`, `speciesId` (SRD id, or absent = custom; the existing `class`, `background`, `race` text stays the display name); `manual?: Partial<Record<AutoField, true>>`; `autoFeatures?: string[]`, `autoProficiencies?: string[]`. Attack gains `ability?`, `proficient?`, `magic?`.

## Shape of the code

- `src/party/autoSheet.ts`: pure `computeAuto(member, srd) → Partial<PartyMember>` and `applyAuto(member, srd)` honouring `manual`. Unit-tested per field (Wizard 5, Fighter 1, Warlock 3, Custom, manual override kept, expertise not downgraded).
- `attackToHit(member, attack)` / damage helpers in `src/party/sheet.ts`, tested.
- CharacterForm: dropdowns, auto tags, Reset to auto; loads SRD via `loadCharacterData()`.
- `src/modes/modes.ts` Combat layout; integration test that the card appears in Combat.

## Slices

1. Combat layout + Player card (tiny).
2. Attack ability/proficient/magic and automatic to-hit.
3. Class/Background/Species dropdowns with Custom.
4. Auto fields with manual override (the bulk).
5. Level from XP, Award XP on the card and at encounter end.

## Out of scope

Subclass picker, multiclassing, class skill choices, prepared-spell counts, class resource trackers (Rages, Ki), ASI handling.
