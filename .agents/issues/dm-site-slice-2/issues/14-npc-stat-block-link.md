# 14: NPC Stat Block link

**What to build:** An NPC can be linked to a Stat Block (SRD or custom) chosen by search, and the NPC card shows the linked Stat Block so its combat numbers are one click away. Adding that NPC to an Encounter uses the linked Stat Block.

**Blocked by:** 04 Custom entries

**Status:** done

- [x] Link and unlink a Stat Block from the NPC card using search
- [x] The NPC card shows or opens the linked Stat Block
- [x] Adding a linked NPC to an Encounter uses its Stat Block (name taken from the NPC)
- [x] A deleted custom Stat Block leaves the NPC intact with a clear "missing" note
- [x] Included in export and import

Implementation: `statBlockId` on the NPC (optional, no DB migration; rides along in export/import). `resolveNpcStatBlock(npc, customs)` in src/srd/npcStatBlock.ts returns the linked monster under the NPC's name (status ok/missing/none) for the combat setup to use. Picker: src/srd/StatBlockPicker.tsx. Tests: src/NpcStatBlock.test.tsx.

Gap closed with ticket 09: the tracker's "Add NPC <name>" buttons (src/panels/AddNpcCombatants.tsx) add a linked NPC via resolveNpcStatBlock, under the NPC's name. Test in src/CombatStatBlock.test.tsx.
