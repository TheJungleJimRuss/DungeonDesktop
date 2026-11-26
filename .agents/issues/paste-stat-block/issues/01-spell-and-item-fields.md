# 01: Spell and item fields

**What to build:** Custom spells get Classes (comma-separated), Ritual (checkbox) and Higher Level (text area) fields; custom items get Attunement. The DM can type them in the editor, they save, and the custom spell and item cards show them the way SRD cards do (e.g. "Level 2 Evocation (ritual) · Wizard", higher-level section after the description, attunement in the item subtitle). Spec: docs/specs/0011-paste-stat-block.md.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Spell editor has Classes, Ritual, Higher Level; item editor has Attunement; values save and reopen
- [ ] Custom spell and item cards show the new fields like the SRD cards
- [ ] Records and export files without the new fields load and show as before (fields optional, default empty; no DB version bump)
- [ ] Campaign export/import keeps the new fields
- [ ] App tests in the Custom Entries test file cover the above
