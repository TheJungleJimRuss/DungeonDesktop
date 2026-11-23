# 03: Class, Background and Species dropdowns

**What to build:** On the character sheet form, Class, Background and Species are dropdowns of the bundled SRD entries plus "Custom…", which reveals a text box. The record keeps the display name in the existing text fields and stores the SRD id (classId, backgroundId, speciesId; absent = custom). Old records whose text matches an SRD name (case-insensitive) show as that entry; others show as Custom with their text. SRD data loads lazily via the character data chunk. Spec: docs/specs/0005-auto-character-sheet.md.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Picking an SRD class/background/species saves name and id
- [x] Custom shows a text box and saves the typed name with no id
- [x] Legacy record "wizard" reads as Wizard; "Hexblade Knight" reads as Custom
- [x] Quick Party form still works
