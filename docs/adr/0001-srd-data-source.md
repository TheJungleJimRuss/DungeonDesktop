# 0001: SRD 5.2 data source, licence and attribution

Status: accepted (2026-11-16, slice 2 ticket 02)

## Decision

- Content: the System Reference Document 5.2.1 (2024 rules), published by Wizards of the Coast under Creative Commons Attribution 4.0 International (CC BY 4.0). Official page: https://www.dndbeyond.com/srd (lists v5.2.1, May 2025; v5.2.0 is also CC BY 4.0). Only SRD content is used; nothing from non-SRD books.
- Machine-readable source: the 2024 monster file of the community repo `5e-bits/5e-database` (code and data files MIT), `src/2024/en/5e-SRD-Monsters.json`, pinned to commit `6f6299e75b4fa56ed882bfb1429f6dc6b4c65330` and verified by SHA-256 `34ec39f2b384a5e1ed11ac6d9e17601a19579ed67fd1775d21588d186714346f`. 341 records (includes shapechanger forms).
- Conversion: `node scripts/build-srd.mjs` (pure mapping in `scripts/srd-convert.mjs`) fetches the pinned file at build time, checks the hash, and writes `src/data/srd/monsters.json` (generated, committed). The app imports it with a dynamic `import()`, so it is a separate lazy chunk served from our own origin. The app never fetches third-party data at runtime. Later types (spells, items, conditions) get their own file beside it (`5e-SRD-Spells.json`, `-Magic-Items.json`, `-Equipment.json`, `-Conditions.json` exist upstream in the same folder).

## Licence verification

- The CC BY 4.0 licence of SRD 5.2.x is stated on the official D&D Beyond SRD page ("released exclusively under Creative Commons (CC-BY-4.0)") and in the SRD's own legal notice.
- Cross-check: the monster names in the upstream file were compared with the SRD 5.2.1 Markdown conversion `downfallx/dnd-5e-srd-markdown` (also CC BY 4.0); all non-animal, non-form names match its stat-block headings (the rest are animals listed in its animals file, or form variants).
- Caveat: the upstream README still says the underlying material is under the OGL 1.0a (true for its 2014 data, stale for the 2024 folder). We rely on the SRD 5.2.1 CC BY 4.0 grant for the 2024 data, not on that README. Open item for the owner: confirm this reading is acceptable; the official PDF (https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf) was downloaded but not text-extracted here, so the attribution sentence below was cross-checked against a published mirror of the SRD legal page, not read from the PDF.

## Attribution wording (shown in the app footer; source in `src/srd/attribution.ts`)

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
> Changes: converted to JSON and reformatted for display.

The Stat Block panel also carries "Source: SRD 5.2.1, CC BY 4.0". No Wizards trademarks or logos are used, and nothing suggests endorsement.

## Known data limits

- SRD 5.2.1 stat blocks have no lair-action lists; lair appears only as extra XP and extra Legendary Resistance/Action uses. The Monster shape has an optional `lairActions` field (for custom entries) that the Stat Block renders when present.
- Legendary Action uses are not in the upstream JSON; the converter sets 3 for every creature with legendary actions (matches all 5.2.1 stat blocks, 4 in lair).

## Update (ticket 03): more types

Spells, magic items, equipment and conditions come from the same pinned commit (files `5e-SRD-Spells.json`, `-Magic-Items.json`, `-Equipment.json`, `-Conditions.json`, each verified by its own SHA-256 in `scripts/build-srd.mjs`) and are written to `src/data/srd/{spells,magic-items,equipment,conditions}.json`, each its own lazy chunk. Counts: 339 spells, 262 magic items, 182 equipment items, 15 conditions. Upstream quirk fixed in the converter: nine spells (e.g. Contagion, Guidance) have their components glued onto the range text; the converter splits them. The same attribution covers all types.

## Addendum: feats, backgrounds and rules (spec 0004, ticket 02)

Same pinned commit, each file verified by its own SHA-256 in `scripts/build-srd.mjs`: `5e-SRD-Feats.json`, `-Backgrounds.json` and seven rules files (`-Skills`, `-Languages`, `-Damage-Types`, `-Weapon-Properties`, `-Weapon-Mastery-Properties`, `-Alignments`, `-Ability-Scores`). Written to `src/data/srd/{feats,backgrounds,rules}.json` (17 feats, 4 backgrounds, 84 rules; `rules.json` joins the seven files, each entry carrying a `kind`). Loaded by `loadCharacterData()` (src/srd/character.ts), separate from the reference loader. The converter flattens upstream references to display strings and plain ids; the attribution text is unchanged.

## Addendum: species and classes (spec 0004, tickets 03-05)

Same pinned commit and the same SRD 5.2.1 CC BY 4.0 basis; the attribution text is unchanged. Species data is written to `src/data/srd/{species,subspecies,traits}.json` (9 species, 24 subspecies, 67 traits). Class data is written to `src/data/srd/{classes,class-levels,subclasses,class-features}.json` (12 classes with 20 level rows each, 12 subclasses, 232 class and subclass features). All of it loads through `loadCharacterData()` in one lazy chunk, which the service worker precaches with the rest of the build (offline e2e opens a class card with the network off).

Every upstream file added by spec 0004, with the SHA-256 the build checks (`scripts/build-srd.mjs`):

| Upstream file | SHA-256 |
|---|---|
| `5e-SRD-Feats.json` | `f80bf64d46b4addb5d991c6b4b1e05e8c0f9209ffbae297222c5439022abcbc3` |
| `5e-SRD-Backgrounds.json` | `8cf80b14ddbfb82e596d51fb9b4d5ece0627297251cb1e99f56d89f5059da7c2` |
| `5e-SRD-Species.json` | `bfb1beb2a61925a496b6d4c9bfe37bf58c735e2c6e6b8e4ad7310b44b4cb1d70` |
| `5e-SRD-Subspecies.json` | `c3d758e9ae42ddb2de71a6ad23863f785266843337c52b386d250781a92cc159` |
| `5e-SRD-Traits.json` | `acbe77b03e08959b6d8901b10d7d9eaad57a2624af121c4ef72157c708bf9427` |
| `5e-SRD-Classes.json` | `0f3bd5dd5931a561a9c5da6bdec1ba2279ad03261ac2dbe7dae23a11273f678e` |
| `5e-SRD-Levels.json` | `963a7b1c597e51f2d6e22068940344193fbb78bf2f0a81274777dec06b3a3fb1` |
| `5e-SRD-Subclasses.json` | `eac4c9f975490f0953e389eeae28bc655527f6ed277146eff6757a9fe1953178` |
| `5e-SRD-Features.json` | `6390b3a1ad2ae68ad21516c38309799f610f893cb008cd3ad920d0eed89f8249` |
| `5e-SRD-Skills.json` | `f3aa1afd9c2f132882cbb17f72a41482f7578d167e72d166259d1455c4b73887` |
| `5e-SRD-Languages.json` | `56c0577430418d3cb6993f8e475ab9e60db8b0cc154fff9d0cbaf988a0ff92d5` |
| `5e-SRD-Damage-Types.json` | `83f074f17afe6ec272b09eab6ac4305171e93cecf77584bd32b21f2e0123321f` |
| `5e-SRD-Weapon-Properties.json` | `a881e9fd8de5e332483871aa9a4e66756cef305582f96a5ff26198477a833db2` |
| `5e-SRD-Weapon-Mastery-Properties.json` | `0932ec552adfc63fdf87d8e5c3fad4035a728092c78e1c8a32a8712c4ce6d969` |
| `5e-SRD-Alignments.json` | `9dddd583e53ba11cef7f377384d5bd78e050fbaf67b093eed811ac41a65e5ba5` |
| `5e-SRD-Ability-Scores.json` | `27f117bcef477273774f8e1c6554ac6a4d2e43551d5a2cb6d4277fb0945e0a6e` |
