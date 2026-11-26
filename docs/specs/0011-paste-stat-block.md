# 0011 Paste stat block

Status: approved 2026-11-25, built (tickets .agents/issues/paste-stat-block/)
Source: user request 2026-11-25. Monsters and spells from the DM's own books aren't in SRD 5.2.1, so they have to be
added as Custom Entries by hand, which is slow.

## Problem Statement
The app bundles only SRD 5.2.1, and its text can't include the 2024 Monster Manual or Player's Handbook. When the DM
needs a creature, spell or magic item from their own books (Beholder, Toll the Dead), they have to type a Custom Entry
field by field. A monster has dozens of fields, so this is slow and easy to get wrong.

## Solution
The Custom Entry editor gets a **Paste stat block** button for monsters, spells and magic items. It opens a dialog
with a text box. The DM pastes text copied from their own source (a PDF of a book, D&D Beyond, or Live Text from a
photo of a page) and presses Fill. The editor's fields fill in from what was read, and any lines that couldn't be
placed are listed under the form. Nothing is saved until the DM checks the form and presses Save.

Custom spells also gain Classes, Ritual and Higher Level fields, and custom items gain Attunement. Both then match
their SRD counterparts and show on their cards the same way.

## User Stories
1. As a DM, I want a Paste stat block button in the custom monster editor, so that I don't type a whole stat block by hand.
2. As a DM, I want the same button in the custom spell and item editors, so that all three kinds are quick to add.
3. As a DM, I want the paste box in a dialog, so that the editor stays uncluttered when I type by hand.
4. As a DM, I want to paste 2024-layout text from D&D Beyond or a book PDF, so that I can use the sources I own.
5. As a DM, I want text from Live Text photos to work despite odd line breaks, so that I can use my physical books.
6. As a DM, I want size, creature type and alignment read from the line under the name, so that the header is right.
7. As a DM, I want AC (with its note), HP with its dice, and every speed read, so that the top of the block is filled.
8. As a DM, I want the six scores read from the 2024 score and save table, so that abilities are right.
9. As a DM, I want saving throw proficiencies read from that table where the save differs from the modifier, so that saves are right.
10. As a DM, I want Skills, Vulnerabilities, Resistances, Immunities (damage and condition), Gear, Senses and Languages read, so that each lands in its own list.
11. As a DM, I want CR read with its XP, XP in lair and PB, so that difficulty and XP awards work.
12. As a DM, I want Traits, Actions, Bonus Actions, Reactions and Legendary Actions split into separate entries with their names, so that each shows as its own item.
13. As a DM, I want legendary action uses read, so that the Stat Block shows the right count.
14. As a DM, I want the Initiative line ignored without being reported as unread, since Combat rolls from Dex for every monster.
15. As a DM, I want a spell's level, school and classes read from its header line, and Ritual from its casting time ("Action or Ritual", as the 2024 layout prints it), so that the spell header is right.
16. As a DM, I want Casting Time, Range, Components and Duration read, so that the spell's details are filled.
17. As a DM, I want the "Using a Higher-Level Spell Slot" (or "Cantrip Upgrade") section kept apart from the description, so that it reads like SRD spells.
18. As a DM, I want an item's type, rarity and attunement read from its first line, so that the item header is right.
19. As a DM, I want the first line to fill Name on a new entry, so that I don't retype it.
20. As a DM, I want a name I already typed kept, so that pasting doesn't rename my entry.
21. As a DM, I want Fill to replace only the fields it read, so that pasting into a saved entry updates it without clearing the rest.
22. As a DM, I want to review and fix the form before saving, so that misreads never reach a saved entry.
23. As a DM, I want Cancel on the form to discard a paste, so that a bad paste costs nothing.
24. As a DM, I want lines it couldn't place listed under the form, so that nothing is silently lost.
25. As a DM, I want a clear message when nothing at all could be read, so that I know the text wasn't recognised.
26. As a DM, I want Classes, Ritual and Higher Level fields on custom spells, so that I can also type them by hand.
27. As a DM, I want custom spell cards to show classes, ritual and the higher-level section like SRD spells, so that both look alike.
28. As a DM, I want an Attunement field on custom items, shown on the card like SRD items, so that attunement is clear.
29. As a DM, I want older custom spells and items without the new fields to load and show as before, so that nothing breaks.
30. As a DM, I want the new fields carried through Campaign export and import, so that backups stay complete.
31. As a DM, I want the dialog to pause other shortcuts and close on Esc, like other dialogs, so that typing doesn't trigger them.

## Implementation Decisions
- **Parser module (new, pure):** one function per kind, each taking the pasted text and returning
  `{ name?, fields: Partial<data>, unread: string[] }`, where `fields` holds only what was read. Data shapes are the
  existing Custom Entry types (the monster one is the SRD Monster shape). No UI or storage dependencies.
- **2024 layout only.** 2014 / Open5e layouts are not targeted; their lines that don't match end up in `unread`.
- Tolerant reading: joins lines broken mid-sentence (PDF and Live Text), normalises dashes, minus signs, ligatures
  and curly quotes, and accepts the score table whether it's laid out as rows or as one value per line.
- Entry splitting: within Traits, Actions and the other sections, a new entry starts at a line beginning
  "Name. " (title-case words followed by a full stop); other lines continue the previous entry's text.
- Saves: a save is recorded as proficient when its value differs from the ability modifier, in the same string form
  the editor already uses.
- The Initiative line is recognised and dropped (not reported as unread).
- **Fill merge rule:** each field in `fields` replaces the form's value; fields absent stay as they are. Name is set
  only when the form's Name is empty.
- **Dialog:** `role="dialog"` (so other shortcuts pause), a labelled text box, Fill and Cancel; Esc closes it. Opened
  from a "Paste stat block" button in all three editors. After Fill it closes and the unread lines show in a notice
  under the form until the next Fill or Save. Fill with nothing read keeps the dialog open with a message.
- The paste marks the form dirty, so the existing unsaved-changes guard covers it.
- **Schema:** spell data gains `classes: string[]`, `ritual: boolean`, `higherLevel: string`; item data gains
  `attunement: string`. These are optional on read and default to empty, so old records and old export files load
  unchanged; no DB version bump.
- The spell and item editors gain those fields (Classes as a comma-separated text field, Ritual a checkbox, Higher
  Level a text area, Attunement a text field). The custom spell and item cards show them the way the SRD cards do.

## Testing Decisions
- Test external behaviour only: what the parser returns for a given text, and what the DM sees and saves in the app.
- **Parser tests** (like the pure geometry and scale tests): one 2024-layout sample per kind covering every field,
  plus cases for Live Text line breaks, the row vs one-per-line score table, multi-paragraph entries, a cantrip,
  a ritual, attunement with and without a class, Name handling and unread lines. Sample text is **invented creatures,
  spells and items written for the tests** in the 2024 layout, never copied from the books.
- **App tests** in the existing Custom Entries test file (whole app on in-memory IndexedDB, driven like a user):
  paste and Fill a monster, spell and item; check the form; save; find each in Global Search and see its card; paste
  into a saved entry keeps unread fields and the name; unread lines shown; nothing-read message; old records without
  the new fields still open; export/import keeps the new fields.

## Out of Scope
- 2014 / Open5e layouts, and reading the user's PDFs or images directly (only pasted text).
- A class filter for spells in Global Search.
- Storing or using a monster's Initiative bonus in Combat.
- Lair actions (not in the 2024 Monster Manual stat block layout this targets).
- Bundling any non-SRD content in the app.

## Further Notes
- Sources the DM can copy from: book PDFs, D&D Beyond pages for books they own, Live Text in macOS/iOS Photos or
  Camera, and third-party stat blocks under open licences.
