# 02: Monster editor UI

Spec: docs/specs/0010-custom-monster-editor.md ("Form layout").

**What to build:** `src/panels/MonsterEditor.tsx` using ticket 01's model; `CustomEntriesPanel.tsx` renders it for monsters (spells/items unchanged). Fieldsets, entry cards, saves, skills, senses, speed, languages, defenses, CR auto.

**Blocked by:** 01

**Status:** done (2026-11-25)

- [x] All fieldsets from the spec, accessible labels; uses GUARD form, aria-label "Custom monster editor", Save/Cancel/Delete entry as today.
- [x] CustomEntries.test.tsx updated + new cases from the spec. Styles in src/styles.css (`ce-` prefix).
