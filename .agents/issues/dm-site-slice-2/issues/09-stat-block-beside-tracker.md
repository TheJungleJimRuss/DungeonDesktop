# 09: Stat Block beside the tracker

**What to build:** In Combat mode the active combatant's Stat Block is shown beside the tracker, and any combatant's Stat Block is one click away. Attack and damage entries in a Stat Block can be clicked to roll through the dice roller.

**Blocked by:** 07 Combat setup and initiative, 06 Dice roller

**Status:** done

- [x] A Stat Block panel in the Combat layout follows the active combatant
- [x] Selecting any combatant in the tracker shows its Stat Block
- [x] Party members without a Stat Block show their Party sheet numbers instead
- [x] Clicking an attack bonus or damage expression rolls it in the dice roller and shows the result in history
- [x] Panels are separate so they can be spread across both monitors, and stay in sync in the Pop-out Window

Implementation: new panel "Combatant Stat Block" (src/panels/CombatantStatBlockPanel.tsx) in the Combat layout; follows the active combatant, or the one picked with the tracker's per-row "Stat Block" button (src/combat/combatSelection.ts; the pick lapses when the turn moves). Party combatants (new `partyId`) show a Party sheet. Clickable attack bonus and damage via src/srd/Rollable.tsx (StatBlock `rollable` prop) into requestRoll. Roll history is per window, so rolling from a popped-out Stat Block shows in that window's Dice Roller. The Search-driven "Stat Blocks" panel stays. Tests: src/CombatStatBlock.test.tsx.
