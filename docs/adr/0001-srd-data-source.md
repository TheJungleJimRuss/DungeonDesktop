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
