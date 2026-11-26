# 01: Endless Map

**What to build:** A Map has no edges and a fixed 5 ft base square. The DM pans without limit. Map settings show only Name, Show grid and Delete, and the summary shows the grid label in view. Distances from the ruler and Routes read in ft or mi from the 5 ft base, switching at 1,000 ft. "Fit all" zooms to everything drawn; on an empty Map it goes to battle scale at (0, 0), which is also where new Maps open. Background images are gone. DB v9 deletes old Maps and the Map links on Encounters and saved Encounters, after a one-time notice with an Export button (shown only if old Maps exist). Import skips old-shape Maps. See spec 0009 "Coordinates and scale", "Map record", "Fit all", "Settings UI" and "Upgrade", and ADR 0003.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Map record drops unit, perSquare, width, height and background. The view is stored per device as { centre, pxPerSquare } (old stored views are ignored), clamped from 1e-7 to 1000 px per square. A named battle-scale constant exists.
- [x] No width, height, scale, unit or background controls. The Map summary shows "1 square = …" for the grid in view.
- [x] Panning has no bounds. The grid covers whatever is in view.
- [x] The ruler and Route lengths read from 5 ft per square, ft below 1,000 ft and mi from there.
- [x] Fit all works on a drawn Map (pads the bounds of Line points, Markers, Tokens and the Party Token) and on an empty one.
- [x] DB v9 clears maps and drops mapId and tokens from encounters and savedEncounters, and keeps everything else. Clears the last-Map and Map-view device keys. A one-time role="dialog" notice with Export appears before deletion when old Maps exist.
- [x] Import of an old export skips old-shape Maps without failing, and drops Encounter links to them.
- [x] Whole-app tests and geometry/scale unit tests cover the above. Old tests for size, scale and background are rewritten or removed. `npx tsc --noEmit` and `npm test` pass.
