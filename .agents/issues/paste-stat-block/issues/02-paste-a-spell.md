# 02: Paste a spell

**What to build:** A "Paste stat block" button in the custom spell editor opens a dialog (role="dialog", labelled text box, Fill, Cancel, Esc closes). The DM pastes a 2024-layout spell and presses Fill: the form fills (name, level, school, classes, ritual, casting time, range, components, duration, description, higher level). Lines it couldn't place show in a notice under the form until the next Fill or Save. Nothing is saved until Save. Spec: docs/specs/0011-paste-stat-block.md.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Pure spell reader returns `{ name?, fields, unread }` with only what was read; tolerant of PDF/Live Text line breaks, dashes, ligatures, curly quotes
- [ ] Header "Level N School (Class, Class)" and "School Cantrip (…)" read; "Ritual" read; "Using a Higher-Level Spell Slot." / "Cantrip Upgrade." go to Higher Level
- [ ] Fill replaces only fields read; Name set only when empty
- [ ] Nothing read: dialog stays open with a message
- [ ] Paste marks the form dirty (unsaved guard)
- [ ] The dialog is reusable by the item and monster editors (tickets 03, 04)
- [ ] Reader tests use invented spells in the 2024 layout, never book text; app tests cover paste → form → save → Global Search and card, paste into a saved entry, unread notice, nothing-read message
