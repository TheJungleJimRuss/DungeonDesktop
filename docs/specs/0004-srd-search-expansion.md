Status: built (2026-11-17), all five tickets done. Local file; no tracker configured.

# SRD search expansion: classes, species, backgrounds, feats, traits and rules

## Problem Statement

Global Search (Ctrl+K) only knows monsters, spells, magic items, equipment and conditions. Mid-session, the DM often needs a character rule: what a Barbarian's Rage does, a Dragonborn's traits, what a feat gives, what the Sap mastery does. Today that means leaving the app.

## Solution

Bundle the rest of the character-facing SRD 5.2.1 data from the same pinned upstream commit (5e-bits/5e-database `6f6299e`, hash-pinned by `npm run build:srd`). Make each kind searchable in Global Search with its own filter chip and result group, and show it as a reference card (in the Stat Blocks panel, or in the side drawer in Modes without one). Sub-entries are their own results: typing "Rage", "Champion", "Breath Weapon" or "Draconic Ancestor: Red" finds that entry directly, labelled with its parent. Each sub-entry card links to its parent card.

## New types (search chip: what it holds)

| Chip | Entries | Card shows |
|---|---|---|
| Classes | 12 classes | Hit die, primary ability, saving throws, proficiencies, skill choices, starting equipment, multiclass notes, **full level table** (level, proficiency bonus, class columns such as Rages and Rage Damage, cantrips/prepared spells, spell slots 1-9 with empty columns hidden), then every feature by level (collapsible, collapsed by default), then its subclasses as links |
| | Subclasses (12) | Parent class link, summary, description, features by level |
| | Class features (232, incl. subclass features) | Parent class/subclass link, level, description |
| Species | 9 species | Creature type, size, speed, traits (collapsible), subspecies as links |
| | Subspecies (24) | Parent species link, damage type if any, traits |
| | Traits (67) | Species it belongs to (links), description |
| Backgrounds | 4 | Ability scores, feat (link), skill and tool proficiencies, equipment options |
| Feats | 17 | Type (Origin, General, Fighting Style, Epic Boon), description |
| Rules | Skills (18), Languages (19), Damage Types (13), Weapon Properties (10), Weapon Mastery (8), Alignments (10), Ability Scores (6) | Kind label and description (skill: its ability; language: rare or standard and its note) |

Result rows show a short summary like today: "Class · d12", "Barbarian feature · level 1", "Champion (Fighter) · level 3", "Dragonborn trait", "Origin feat", "Weapon mastery".

## User Stories

1. As a DM, I want to search a class by name and open its full reference, so that I can answer a player's rules question without leaving the app.
2. As a DM, I want the class level table with only the columns that class uses, so that I can read spell slots or Rages at a glance.
3. As a DM, I want to type a feature name ("Rage", "Sneak Attack") and open just that feature, so that I don't scroll through a whole class.
4. As a DM, I want a feature, subclass or trait card to link to its parent, so that I can see the context in one click.
5. As a DM, I want to find species, subspecies and traits by name, so that I can check what a player's character can do.
6. As a DM, I want backgrounds and feats searchable, so that I can check what a character got at creation.
7. As a DM, I want a Rules group for skills, languages, damage types, weapon properties, mastery, alignments and ability scores, so that the small rules are one search away.
8. As a DM, I want a filter chip per new type, so that "Rage" can be narrowed to class content.
9. As a DM, I want the dialog to stay usable with more groups: each group capped at 8 results under "All" (20 when its chip is chosen), so that one type can't push the others out of view.
10. As a DM, I want ↑/↓/Enter to move across all groups in display order, including Custom, so that the keyboard reaches every result.
11. As a DM, I want every new entry to open offline, so that it works at a table with no internet.
12. As a DM, I want the SRD attribution footer to keep covering the new data, so that the licence terms are met.

## Implementation Decisions

- **Build**: add the needed upstream files to `SOURCES` in scripts/build-srd.mjs with their SHA-256 hashes (Classes, Levels, Features, Subclasses, Species, Subspecies, Traits, Backgrounds, Feats, Skills, Languages, Damage-Types, Weapon-Properties, Weapon-Mastery-Properties, Alignments, Ability-Scores). New converters in scripts/srd-convert.mjs join them into five output files: `classes.json` (classes with levels and feature ids, subclasses, features), `species.json` (species, subspecies, traits), `backgrounds.json`, `feats.json`, `rules.json`. Equipment option text and proficiency choices are flattened to display strings in the converter, so the app never resolves upstream `url` references.
- **Loading**: a second lazy loader, `loadCharacterData()`, has its own chunk (like monsters and reference). `loadSearchData()` loads all three. A test source hook like `setReferenceSource` plus a small fixture covers tests.
- **Types**: `RefType` gains `class`, `subclass`, `class-feature`, `species`, `subspecies`, `trait`, `background`, `feat` and `rule`. Rules entries carry a `kind` field (skill, language, …). `REF_TYPES` gains five chips (Classes, Species, Backgrounds, Feats, Rules). The Classes chip shows class, subclass and class-feature results, and the Species chip shows species, subspecies and traits. Selection ids stay `ref:<type>:<id>`, so selection, cross-tab sync and the drawer work unchanged.
- **Ids**: upstream indexes are unique within each file but not across files (e.g. a feature and a trait could share one), so ids are used per type and never mixed across types.
- **Search**: same fuzzy name search (src/srd/search.ts) and same ranking. No description search in this spec. Group caps: 8 under "All", 20 when a chip is chosen. Monster CR and type filters stay as they are.
- **Cards**: new views in src/srd/ReferenceCards.tsx (or a sibling CharacterCards.tsx if it would pass about 300 lines), reusing `RichText` for descriptions. Parent and child links set the selection (same as opening a search result). Collapsible sections use `<details>`.
- **Keyboard fix**: today the Custom group can only be reached by Enter when there are no SRD hits. Active-index navigation will cover Custom rows too (story 10).
- **Licence**: same source and licence (SRD 5.2.1, CC BY 4.0). Record the added files in ADR 0001. The attribution text does not change.

## Testing Decisions

- Converter unit tests run on trimmed upstream samples: level table columns (class_specific, spell slots, empty columns dropped), subclass features land under the subclass, traits linked to every species that lists them, and option text flattened.
- Data well-formedness test (like the monsters one): every new entry is found by its own name in the top 10, and every parent and child link resolves.
- App tests (in-memory IndexedDB, driven like a user): search "rage" → open the Rage feature → follow the link to Barbarian → the level table shows a Rages column. Chip narrowing. The All-view group cap. ↑/↓ reaches a Custom result. Opening a Species in a Mode without Stat Blocks uses the drawer.
- Offline e2e: extend the existing offline spec to open a class card with the network off (the new chunk is precached).

## Out of Scope

- Searching descriptions or full text; campaign content (NPCs, Locations, notes) in search; spell/item filters beyond today's. These were offered and not picked; possible later specs.
- Character sheets built from this data (picking a class or species on a party member).
- Poisons, Proficiencies and Equipment Categories files.
- Non-SRD content.
