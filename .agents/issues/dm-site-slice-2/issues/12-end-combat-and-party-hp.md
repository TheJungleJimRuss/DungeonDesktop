# 12: End combat and Party HP

**What to build:** The Party sheet gains current HP alongside max HP, and Party combatants sync with it during an Encounter. Ending combat writes each Party member's remaining HP back to the Party sheet, so the next scene starts with the right numbers. The Dashboard Party panel shows current HP.

**Blocked by:** 08 HP and defeat

**Status:** done

- [x] Party members have current HP (defaulting to max), editable on the Party sheet, shown on the Dashboard
- [x] Party combatants in an Encounter start from current HP
- [x] Ending an Encounter writes remaining HP back to the Party sheet
- [x] Existing Campaigns and exports without current HP still load (current HP defaults to max)
- [x] Included in export and import
