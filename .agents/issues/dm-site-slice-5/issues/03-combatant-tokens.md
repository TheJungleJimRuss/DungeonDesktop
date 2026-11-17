# 03: Tokens linked to Combatants

**What to build:** Tokens can link to Combatants of the Encounter. "Add tokens for all combatants" places one per Combatant that has none; linked tokens show the Combatant's name and colour (colour stored on the token, defaulted per Combatant). Selecting a token highlights its Combatant in the Initiative tracker and selecting a Combatant highlights its token (shared selection, synced to the Pop-out Window; see src/combat/combatSelection.ts). Defeated Combatants' tokens are visibly marked (and hidden if the Encounter's defeat mode removes them); removing a Combatant removes its token. Covers stories 75, 76, 77.

**Blocked by:** 01

**Status:** done

- [x] Link a token to a Combatant; bulk add for unplaced Combatants
- [x] Names follow the Combatant (renames, auto-numbering)
- [x] Two-way selection highlight between map and tracker, across windows
- [x] Defeated tokens marked; removed Combatants remove their token
- [x] Whole-App test
