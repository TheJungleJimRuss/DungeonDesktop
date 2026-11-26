# 04: Select and remove a Hole

**What to build:** While an Area is selected its Hole edges show; clicking a Hole's edge selects that Hole (one at a time). The Area editor then shows "Remove hole"; Delete removes the selected Hole instead of the Area; Esc steps from Hole back to Area selection, then on as before. Hole edges are not shown or clickable when the Area isn't selected.

**Blocked by:** 01

**Status:** done

- [x] jsdom app tests (Holes seeded in storage): edges only while selected, select Hole, Remove hole, Delete removes only the Hole, Esc steps back

**Notes:** Tests in src/MapHoles.test.tsx. While Subtract shape waits, Hole edges still draw but don't take clicks (a cutter whose edge lies on a Hole's edge, such as the pillar that made it, stays clickable); starting Subtract shape drops the Hole selection.
