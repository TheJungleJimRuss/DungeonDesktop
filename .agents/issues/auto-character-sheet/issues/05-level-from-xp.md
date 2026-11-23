# 05: Level from XP and Award XP

**What to build:** A Party member's level follows their XP (5e thresholds, 300 = level 2 … 355,000 = 20) as an auto field: typing a level marks it manual (milestone play) and "Reset to auto" returns to XP; no XP = typed level kept. The Player card has an "Award XP" box that adds XP and, if the level changes, re-runs the auto fields (HP, slots, features, saves). Ending an Encounter offers "Award XP to party", pre-filled with the defeated monsters' XP total and split evenly (rounded down) among the Party combatants in it; the DM can edit the total or skip. Spec section 5 in docs/specs/0005-auto-character-sheet.md.

**Blocked by:** 04 (auto fields and manual override must exist and be re-runnable outside the form).

**Status:** done

- [x] levelForXp unit-tested at thresholds and edges (0, 299, 300, 355,000+)
- [x] Award XP on the card adds XP; crossing a threshold raises level and auto fields
- [x] Manual level is not changed by awarding XP
- [x] End encounter flow shows the split, pre-filled from defeated monsters, editable, skippable
- [x] Integration tests for card award and encounter award
