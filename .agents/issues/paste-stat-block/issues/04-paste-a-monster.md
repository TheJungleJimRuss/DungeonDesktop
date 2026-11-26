# 04: Paste a monster

**What to build:** The Paste stat block button in the custom monster editor, using the dialog from 02, with a monster reader for the 2024 layout: name; size, type, alignment; AC (and note), HP and dice, speeds; the six scores and proficient saves from the score/save table (rows or one value per line); Skills, Vulnerabilities, Resistances, Immunities (damage and condition), Gear, Senses, Languages; CR with XP, XP in lair, PB; Traits, Actions, Bonus Actions, Reactions, Legendary Actions (split into named entries at "Name. "), legendary uses. The Initiative line is dropped silently. Spec: docs/specs/0011-paste-stat-block.md.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Monster reader returns `{ name?, fields, unread }` in the SRD Monster shape and the editor's existing string forms (saves, skills, speeds, senses, languages)
- [ ] A save counts as proficient when its value differs from the ability modifier
- [ ] Multi-paragraph entries stay one entry; PDF/Live Text line breaks are joined
- [ ] Same merge rule, unread notice and nothing-read message as spells
- [ ] Reader tests with invented creatures in the 2024 layout, never book text; app test: paste → form → save → Global Search → Stat Block, and adding it to Combat works
