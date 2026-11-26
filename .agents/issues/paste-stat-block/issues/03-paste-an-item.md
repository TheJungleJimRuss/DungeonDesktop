# 03: Paste an item

**What to build:** The Paste stat block button in the custom item editor, using the dialog from 02, with an item reader: name, type, rarity and attunement from the first line ("Wondrous Item, Rare (Requires Attunement by a Wizard)"), and the rest as the description. Spec: docs/specs/0011-paste-stat-block.md.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Item reader returns `{ name?, fields, unread }`; handles attunement with and without a class, and none
- [ ] Same merge rule, unread notice and nothing-read message as spells
- [ ] Reader tests with invented items; app test: paste → form → save → card
