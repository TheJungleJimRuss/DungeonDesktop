# 04: Auto fields with manual override

**What to build:** For an SRD class, these fields follow class + level + species + abilities: saving throw proficiencies, Hit Dice, Max HP, spellcasting ability, spell slots 1-9, speed, armor/weapon proficiencies (+ background tool), background skills marked proficient (never downgrading expertise), and generated features (class features to current level, background origin feat, species traits). Auto fields show an "auto" tag; editing one marks it manual (stored in `manual`), and "Reset to auto" clears it. Generated list entries live apart from the DM's own entries (autoFeatures, autoProficiencies) and regenerate on level change. Values are written into the record on save so every existing reader keeps working. Custom class = class-driven fields manual. Proficiency bonus shown on the Player card. Rules table in docs/specs/0005-auto-character-sheet.md.

**Blocked by:** 03 (needs classId/backgroundId/speciesId).

**Status:** done

- [x] Pure computeAuto/applyAuto unit-tested: Wizard 5, Fighter 1, Warlock 3, Custom class, manual override kept, expertise not downgraded
- [x] Max HP: level 1 die max + CON, later levels die average + CON, min 1 per level
- [x] Changing level in the form updates auto fields before save
- [x] Hand-added features/proficiencies survive a level change
- [x] Player card shows proficiency bonus and generated features
