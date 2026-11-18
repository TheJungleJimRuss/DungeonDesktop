# 02: Feats, Backgrounds and Rules in search

**What to build:** The DM can search and open SRD 5.2.1 Feats, Backgrounds and Rules entries (Skills, Languages, Damage Types, Weapon Properties, Weapon Mastery, Alignments, Ability Scores) from Global Search, with Feats, Backgrounds and Rules chips and result groups, and cards in the Stat Blocks panel or side drawer. This slice also lays the shared path for tickets 03 and 04: new hash-pinned upstream files in the SRD build, converters that flatten upstream references to display strings, and a separate lazy "character data" chunk loaded by search alongside monsters and reference data, with a test source hook and fixture. Spec: docs/specs/0004-srd-search-expansion.md.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] `npm run build:srd` fetches the added files from the pinned commit, verifies each SHA-256, and writes feats, backgrounds and rules JSON
- [x] Feat card: type and description. Background card: ability scores, feat (a link that opens the feat card), proficiencies and equipment options. Rule card: kind label and description (skill shows its ability; language shows rare/standard and its note)
- [x] Row summaries, e.g. "Origin feat", "Background", "Weapon mastery"
- [x] Selection ids stay `ref:<type>:<id>`; opening works across tabs and in the drawer
- [x] Converter unit tests on trimmed samples; a well-formedness test where every entry is found by its own name in the top 10; app test: search, chip narrowing, open, follow the feat link
