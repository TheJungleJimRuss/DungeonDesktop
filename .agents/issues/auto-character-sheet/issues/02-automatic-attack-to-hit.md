# 02: Automatic attack to-hit

**What to build:** Each attack on a Party member's sheet picks an ability (STR, DEX, Finesse = better of STR/DEX, Spell = spellcasting ability), has a Proficient tick (on by default) and an optional magic bonus. To-hit = ability mod + proficiency bonus (if proficient, from level) + magic. Damage = dice + ability mod + magic + existing flat bonus. Changing level or ability scores updates to-hit with no edit. Old attacks with a typed attack bonus and no ability keep their number until edited. Player card Gear tab shows to-hit and damage for every attack. Spec: docs/specs/0005-auto-character-sheet.md.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Unit tests for to-hit and damage (STR, DEX, Finesse, Spell, not proficient, magic, legacy attack)
- [x] Attack editor has ability, Proficient and magic inputs; the manual attack bonus input is gone for new attacks
- [x] Gear tab and sheet show "+N to hit" and damage text from the computed values
- [x] Level-up changes the shown to-hit
