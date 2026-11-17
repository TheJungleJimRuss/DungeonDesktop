# 03: NPC name generator and quick NPC

**What to build:** A Name Generator panel in Social mode producing a handful of fantasy names at a time (bundled original word lists, no third-party data; optional ancestry/style choice), reroll on demand, and a one-click "Create NPC" per name that saves an NPC (placed at the Party's current location when one is set) and selects it on the NPC card. Pure generator with an injectable RNG, like src/dice/dice.ts. Covers stories 65, 66.

**Blocked by:** 01

**Status:** done

- [x] Name Generator panel registered and placed in Social mode; reroll button
- [x] Generator is pure and seedable (unit test for determinism and variety)
- [x] One click creates an NPC from a name, at the Party's location if set, and selects it
- [x] Whole-App test
