# 05: Encounter spot and Find fit rules

**What to build:** Starting an Encounter uses the spot in view (the view centre, or the device's last view centre for that Map, else (0, 0)). If the view is zoomed out past battle scale, it zooms to battle scale at the spot. Combatant Tokens are placed by the free-square search starting from the spot. Encounters and saved Encounters store the spot. Loading a saved Encounter, or switching to Combat with one running, shows the spot at battle scale unless this device already has a view for that Map. Find goes to a Marker at its placedAt zoom (if Marker Priority exists, else keeps zoom), to a Line or Area fitted to its bounds, and to a Token or the Party Token at battle scale. See spec 0009 "Encounters" and "Find".

**Blocked by:** 01.

**Status:** done

- [x] Encounter and SavedEncounter gain spot?: { x, y }, which survives export/import.
- [x] Starting zoomed out sets battle scale at the spot, and Tokens land near it (whole-app test).
- [x] A saved Encounter reopens at its spot. One whose Map is missing loads onto a new blank Map.
- [x] Find fit rules per target type (whole-app test).
- [x] Tests pass. tsc is clean.
