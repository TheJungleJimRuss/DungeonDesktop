# Mock playthrough: 2026-11-23

**Build tested:** HEAD `afca369`, in a separate worktree. The working tree on `main` doesn't run right now (see B1).
**Viewport:** 1280×800, dark theme. Console stayed clean (no errors or warnings) the whole run.

**Scenario:** a new DM runs a first session of "Sunless Crypt", start to finish:

1. Create the campaign and open it.
2. Party: Brakka (Dwarf Fighter 3, Soldier) and Ilsa (Elf Wizard 3, Sage), built through the auto sheet.
3. Prep: a session "Into the Crypt", a Dungeon location, an NPC named with the name generator, and a scene with that NPC.
4. Combat: start an Encounter, add the whole party plus 3 SRD Ghouls, roll monster initiative, type in player initiative, add tokens for all combatants, kill a Ghoul, drop Ilsa to Dying, paralyze Brakka for 1 round, step through turns into round 2, end with the XP award.
5. Explore, Roleplay and Global Search.

**What worked well:** auto HP, hit dice, saves and spell slots were all correct. Picking a background filled in skills, features, kit and gold. XP floors at the current level's threshold, so a level 3 character with 0 XP who gets 100 XP ends up on 1,000. The Dying state and death-save counters worked. Condition countdowns expired at the right point. Condition chips open their rule text. Monsters have a "Roll HP" button. The XP dialog splits XP evenly and lets you edit the total. Clicking a Ghoul in search added "3 × Ghoul" in one step.

---

## Bugs

| # | Severity | Finding | Where |
|---|---|---|---|
| B1 | Fixed 2026-11-23 (ticket 02 finished) | The working tree doesn't build. Vite fails on `src/storage/maps.ts:4`, which still imports `toStoredImage` from `./battleMaps`, a file ticket 02 already deleted. `tsc` also lists unused imports in `MapPanel.tsx` and old `BattleMap*.test.tsx` files that still use the `battleMaps` collection. Expected mid-ticket, but `npm run dev` currently shows only an error overlay. | `src/storage/maps.ts`, `src/panels/MapPanel.tsx`, `src/BattleMap*.test.tsx` |
| B2 | Fixed 2026-11-23 | Dwarven Toughness is listed as a feature but doesn't change Max HP. Brakka (Fighter 3, CON 14) shows 28 HP; with Dwarven Toughness it should be 31. The Tough feat will have the same problem. | `autoMaxHp` in `src/party/autoSheet.ts` |
| B3 | Fixed 2026-11-23 | The Soldier kit adds an item literally named **"Gaming Set (same as above)"**: raw SRD text leaking through. The background's tool proficiency (a gaming set) is also missing from Proficiencies, while the Sage's Calligrapher's Supplies does come through. | background kit and proficiency merge (`mergeAutoLists`) |
| B4 | Low | In the NPC form, clicking a suggested name collapses the suggestion list and the fields below jump up. The next click lands in the wrong field: a click aimed at Role typed into Motivation. | NPC form, name suggestions |
| B5 | Low | Tab from a player's initiative box goes to "Expand <name>", not to the next player still missing initiative. The list re-sorts on every entry, so the row you were on moves away while you're entering initiative. | `InitiativeTrackerPanel.tsx` |
| B6 | Low | The page as a whole scrolls in Combat (stat block and dice roller sit below the fold at 800 px tall), and it jumps after actions like Damage, Enter in a field, or ending the encounter. After "Award and end" the view was left on a blank stretch of the page. | Combat mode layout |

## Rules gaps (5e 2024): the app is the DM's rules engine here, so these matter most at the table

| # | Impact | Gap |
|---|---|---|
| R1 | Fixed 2026-11-23 (spec 0008) | **Damage ignores resistance, immunity and vulnerability.** There's no damage-type picker on Damage, so 10 poison damage to a Ghoul (poison immune) takes 10 HP. Suggest an optional type dropdown next to Amt that halves, zeroes or doubles the damage from the stat block and says why ("Immune: poison"). |
| R2 | Fixed 2026-11-23 (spec 0008) | **No encounter difficulty.** While building an encounter the DM can't see the XP budget (2024: Low, Moderate or High per character level). That's the most common thing to check in prep. Show "Moderate (300 / 450 XP)" in the Initiative add area and in Saved Encounters. |
| R3 | Medium | **0 HP doesn't apply Unconscious.** A Dying PC has no Unconscious condition, so attackers get no auto-crit reminder, and Passive Perception still counts them ("Highest: 10 (Brakka, Ilsa)" while Ilsa was dying). Massive damage (instant death) isn't checked either. |
| R4 | Medium | **No short or long rest.** After the fight Ilsa stays at 0 HP with used spell slots, and the only fix is editing each value by hand. A Party-level "Long rest" (full HP, slots, hit dice back, death saves cleared) and a "Short rest" (spend hit dice) would remove the most repetitive edits between sessions. |
| R5 | Medium | **AC never auto-calculates.** It stays 10 for every class. It could come from equipped armor and shield in Equipment (the SRD gear data is already loaded), with the usual manual override. |
| R6 | Low | Only the **background** starting kit is added. Class kit option A (a Fighter's chain mail and greatsword, a Wizard's spellbook and focus) and its gold are missing. |
| R7 | Low | Choices the 2024 rules ask for aren't prompted: background ability score increases (+2/+1), class skill picks (Fighter picks 2), the Elf's Keen Senses skill, languages, the Fighting Style feat. A small "Still to choose: 2 class skills, 1 language…" checklist on the sheet would catch these without automating everything. |
| R8 | Low | Weapons in Equipment (Spear, Shortbow, Quarterstaff) don't become Attacks, and a new attack doesn't fill dice or damage type from the SRD weapon. Typing "Longsword" only gave 1d8 slashing because those are the form's defaults. |

## UX improvements

| # | Area | Suggestion |
|---|---|---|
| U1 | Global Search | It only finds SRD content. Searching "Hradg" doesn't find the NPC Hradgarrik. It should also cover campaign data: NPCs, Locations, party, Scenes, notes. That's what a DM reaches for mid-session. |
| U2 | Battle Map | The token of the active-turn combatant isn't highlighted, and tokens show no HP or condition status. A ring on the active token and a small bloodied or condition marker would let the map carry the turn. (Belongs with unified-map ticket 02.) |
| U3 | Combat | No undo for HP changes. A mis-typed 25 instead of 5 marks a monster Defeated and disables Heal. A one-step "Undo" toast after Damage or Heal would fix it. |
| U4 | Combat | When a Dying PC's turn comes up, nothing asks for a death save. Show a "Roll death save" prompt (d20 with an auto success or failure tick) on that row. |
| U5 | Combat | The XP dialog only counts defeated monsters. Add a per-monster checkbox (default: defeated) so monsters that fled or surrendered can still award XP. |
| U6 | Dice Roller | Monster initiative rolls show in history as "19 1d20+2 [17] + 2" with no name. Label them ("Ghoul 3 initiative"). |
| U7 | Scenes | A Scene can list NPCs but not an encounter. Linking a Saved Encounter to a Scene, with a "Run" button that starts it in Combat, would connect prep and play. |
| U8 | Campaign picker | Creating a campaign doesn't open it, and the new one goes to the bottom of the list. (Known finding 11, still open.) |
| U9 | Prep: Locations | The quick-add row is cramped at 1280 px: the name box shows "New locatio", and the unlabeled "14" number box (size) means nothing to a new user. A stray "•" sits under the empty state. Each location also has two star buttons ("Star X in list" and "Star X"). |
| U10 | Initiative add area | The add controls sit in a narrow right column: "Add ad-hoc" wraps onto 3 lines, and "Party all in (none available)" reads like an error. Before the party loaded it said "Add player… (none available)" even though the party existed. |
| U11 | Character sheet | The equipment list on the sheet view has uneven gaps (items wrap with blank rows), and the add-item box is cut off ("Add i"). In the editor, the Spellcasting "AUTO" badge floats on its own line. |

## Suggested order

1. **B1**: finish or stabilize unified-map ticket 02 so `main` runs again.
2. **B2, B3**: small, contained auto-sheet fixes with clear expected values. Good TDD tickets.
3. **R1 and R2** together: "Combat rules pass" (damage types, encounter difficulty). They change outcomes at the table the most.
4. **R3, R4, U3, U4**: "Dying and resting" slice.
5. **U1**: campaign-wide search.
6. **U2** folds into the unified-map tickets. The rest are polish.

Not tested in this run: export and import (it downloads a file), offline mode, Custom Entries, Saved Encounters, multi-tab sync, keyboard-only use of the map.
