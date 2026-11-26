# 0007 Unified Map

Status: approved (2026-11-23). Label: ready-for-agent. Decision record: ADR 0002 (fresh start).

## Problem Statement

The DM has two unrelated map tools:

- a **World Map**, where Locations are circles joined by edges with typed miles;
- a **Battle Map**, a grid that only exists while an Encounter is running.

Neither can draw anything. There is no way to:

- sketch a dungeon room with walls and doors;
- outline a forest or a city;
- drop a "camp" or "treasure" pin.

A battle map can't be prepared ahead of time or reused, and a city map can't hold a fight.

## Solution

One **Map** tool. A Campaign holds any number of named Maps, such as a world, a city or a dungeon floor. Every Map has the same tools:

- **Draw** Lines point to point. Click the first point to close a Line into a **Shape**.
- Mark any segment as a **Wall** or a **Door**.
- Select a Shape and make it an **Area** with a kind ("City", "Forest"), a color and a name, optionally linked to a Location.
- Draw **Routes** that show their length in the Map's unit.
- Place iconed **Markers**, optionally linked to a Location.
- Place **Tokens**, including an optional **Party Token** that sets where the party is.

An Encounter is played on a Map: either one the DM picks, or a blank one made for it. One Map panel replaces both old map panels.

## User Stories

### Maps
1. As a DM, I want to create a named Map, so that I can prepare a world, a city or a dungeon floor before play.
2. As a DM, I want any number of Maps per Campaign, so that each region or dungeon level gets its own.
3. As a DM, I want to rename and delete a Map, so that my map list stays tidy.
4. As a DM, I want deleting a Map to ask for confirmation, so that I don't lose a prepared map by accident.
5. As a DM, I want to set a Map's scale as "1 square = N feet" or "1 square = N miles", so that a dungeon and a continent both measure correctly.
6. As a DM, I want to show or hide the grid, so that a world map isn't covered in squares while a battle map is.
7. As a DM, I want to set a Map's width and height in squares, so that the map area fits the place.
8. As a DM, I want to put a background image on any Map, scaled and offset, so that I can draw over a picture of the place.
9. As a DM, I want to zoom and pan any Map, with the view remembered per Map on this device, so that I come back to where I was.
10. As a DM, I want a picker in the Map panel to switch Maps, so that I can move between places quickly.
11. As a DM, I want the Map panel outside Combat to open the last Map I viewed, so that I don't pick it again each time.
12. As a DM, I want Maps to be included in campaign export and import (background images included), so that my backups are complete.

### Drawing Lines and Shapes
13. As a DM, I want a Draw tool where each click adds a point joined to the last by a straight segment, so that I can trace walls and outlines.
14. As a DM, I want points to snap to grid corners while the grid is shown, so that walls line up with squares.
15. As a DM, I want points placed freely while the grid is hidden, so that I can trace coastlines on a world map.
16. As a DM, I want to click the first point to close the Line into a Shape, so that I can make rooms and regions.
17. As a DM, I want Enter or a double-click to finish an open Line, so that I can draw a single wall or river.
18. As a DM, I want Esc to cancel the Line I'm drawing, so that a misclick costs nothing.
19. As a DM, I want to see a preview segment from the last point to the cursor while drawing, so that I can see where the next segment will go.
20. As a DM, I want to select a Line or Shape and drag its points, so that I can fix a drawing.
21. As a DM, I want to delete a selected Line, Shape, Marker or Token, so that I can remove mistakes.
22. As a DM, I want to mark each segment as plain, Wall or Door, so that a room's walls and doorways are clear.
23. As a DM, I want Walls drawn thick and Doors drawn as a gap with a door mark, so that the layout reads at a glance.
24. As a DM, I want Walls to be visual only, so that I stay in charge of movement and sight.

### Areas
25. As a DM, I want to turn a selected Shape into an Area, so that a drawn outline becomes a city, forest or other region.
26. As a DM, I want to give an Area a free-text kind and a color, so that I can label any kind of region.
27. As a DM, I want to give an Area a name shown on the Map, so that players' destinations are labelled.
28. As a DM, I want an Area filled with its color, translucent and under Lines, Markers and Tokens, so that it never hides what's on top.
29. As a DM, I want to link an Area to an existing Location or create a new Location from it, so that the NPCs and Scenes tied to that place connect to the drawing.
30. As a DM, I want a linked Area to show the Location's name, so that renaming a place renames it on every Map.
31. As a DM, I want to turn an Area back into a plain Shape, so that I can undo the decision.

### Routes
32. As a DM, I want a Route tool that draws a Line as a Route, so that roads and paths are told apart from walls.
33. As a DM, I want a Route to show its total length in the Map's unit (all segments times the scale), so that I can tell travel distance at a glance.
34. As a DM, I want a Route's length to update as I drag its points, so that the number always matches the drawing.

### Markers
35. As a DM, I want to place a Marker anywhere on a Map, so that I can pin a camp, a treasure or a point of interest.
36. As a DM, I want to give a Marker a name, a color, a short note and an icon from a fixed set (pin, city, camp, cave, skull, chest, door, tower, temple, tavern, ship, star), so that it says what it is.
37. As a DM, I want to drag a Marker freely, without snapping, so that it sits exactly where I want.
38. As a DM, I want to link a Marker to an existing Location or create one from it, so that a world-map pin connects to its NPCs and Scenes.
39. As a DM, I want one Location to appear on several Maps (a Marker on the world, an Area on the city map), so that a place isn't duplicated.
40. As a DM, I want to see a Marker's note when I select it, so that my reminders are on the map.
41. As a DM, I want selecting a linked Marker or Area to select its Location, so that the Locations panel shows its details.

### Tokens
42. As a DM, I want to place Tokens on any Map, snapped to squares, so that I can lay out a fight before it starts.
43. As a DM, I want Tokens to keep snapping to squares even when the grid is hidden, so that positions stay consistent.
44. As a DM, I want to move Tokens by dragging or with the arrow keys, as today, so that the keyboard path stays.
45. As a DM, I want Tokens linked to Combatants (name, defeat mark, speed ring) to work on any Map, so that Combat works the same.
46. As a DM, I want the ruler to measure in the Map's unit, so that it works on world maps as well as battle maps.
47. ~~As a DM, I want Tokens to stay on the Map after the Encounter ends, so that the aftermath stays where it was.~~ Replaced 2026-11-26: ending an Encounter asks whether to keep its linked Tokens (as free Tokens) or remove them (default); free Tokens stay.

### Party Token
48. As a DM, I want to add an optional Party Token to a Map (at most one per Map), so that I can show where the group is.
49. As a DM, I want dropping the Party Token inside an Area, or on a Marker, that is linked to a Location to set the party's location, so that features that use the party location stay current.
50. As a DM, I want removing the Party Token to leave the party location as it was, so that tidying a map doesn't change campaign state.

### Encounters
51. As a DM, I want to pick a Map when I start an Encounter, so that I fight on a map I prepared.
52. As a DM, I want a blank 20×20, 5 ft Map named after the Encounter made for me when I pick none, so that a quick fight just works.
53. As a DM, I want new Combatants' Tokens lined up on the Encounter's Map as today, so that setup stays fast.
54. As a DM, I want the Map panel in Combat to show the running Encounter's Map, so that I don't switch by hand.
55. As a DM, I want a saved encounter to remember its Map and where its Tokens stood, so that loading it sets the fight up again.
56. As a DM, I want loading a saved encounter whose Map was deleted to fall back to a blank Map, so that it still loads.

### Migration
57. As a DM, I want the upgrade to remove the old World Map positions, edges and Battle Maps cleanly, so that no dead data lingers (ADR 0002).
58. As a DM, I want my Locations, NPC links, Scenes and party location kept through the upgrade, so that only map drawings start fresh.
59. As a DM, I want importing an older export to skip its old map data without failing, so that old backups still load.

## Implementation Decisions

- **New Map record** (a new campaign-scoped collection `maps`, synced across tabs through the change bus):
  - name; `unit` ("ft" | "mi"); `perSquare` (number); `showGrid`; width and height in squares;
  - background (the same shape as today's map background, with the image stored as `{type, ArrayBuffer}`);
  - `lines`, `markers`, `tokens`, and an optional `partyToken`.
  - Everything lives on the one record (like today's Battle Map), so a Map is one read-modify-write and one sync event.
- **Shapes of the parts:**
  - `Line`: `{ id, points: {x,y}[], closed, segments: ("plain"|"wall"|"door")[], route?: true, area?: { kind, color, name?, locationId? } }`.
  - `segments[i]` describes points i→i+1; a closed Line has one more segment, last point back to first.
  - Only closed Lines may have `area`; only open Lines may be `route`.
- **Marker**: `{ id, x, y, name, color, icon, note, locationId? }`. Icons are a fixed list of about 12 ids, matched to bundled inline SVGs (no network, so it works offline).
- **Coordinates:**
  - Map units, where one square = one unit. Lines snap to integer corners while the grid is shown.
  - Markers are free (fractional); Tokens snap to whole squares.
- **Geometry module** (pure, no DOM):
  - snap-to-corner;
  - polyline length × `perSquare`, formatted with the unit;
  - point-in-polygon (for the Party Token over an Area);
  - nearest point / segment hit radius in screen pixels.
- **Map panel** (`map`) replaces `battle-map` and `world-map` in the panel registry and in the Combat and Explore mode layouts.
  - Saved Dashboard layouts that name an old panel id get it remapped to `map`.
  - Tool bar: Select, Draw, Route, Marker, Token, Ruler.
  - Selection opens an inline editor under the canvas: segment types, Make Area / Unmake, Area fields, Marker fields, Delete.
- **Panel's Map choice:**
  - In Combat with an in-progress Encounter, the panel shows the Encounter's Map.
  - Otherwise it shows the last viewed Map (per Campaign, this device, in localStorage like the old view keys), or the first Map, or an empty state with "New map".
- **Encounter** gains `mapId`.
  - Starting an Encounter offers a Map picker.
  - With no choice, a blank Map is created (20×20, 5 ft, grid on, named after the Encounter).
  - Combatant Token placement reuses today's side-lining logic, moved to work on a Map.
  - Ending an Encounter asks (checkbox "Keep its tokens on the map", off by default): off removes its linked Tokens, on turns them into free Tokens with their last name (changed 2026-11-26 at the DM's request); free Tokens always stay.
- **Saved encounter** stores `mapId` plus `tokens` (each with position and the same link key used today) instead of a whole map copy.
  - Loading replaces that Map's tokens for those links, and creates a blank Map if `mapId` no longer exists.
- **Party Token:**
  - On drop, if the point is on a linked Marker (within hit radius) or inside a linked Area, the campaign's party location is set to that Location.
  - When several Areas overlap, the smallest one by area wins.
- **Location** loses `x`/`y`.
  - Deleting a Location clears `locationId` on every Marker and Area that links to it, keeping their own name as text.
  - Renaming needs no fan-out, because linked items read the name live.
- **Migration:** a DB version bump creates `maps`, deletes the `edges` and `battleMaps` stores, strips Location `x`/`y`, and drops saved-encounter `map`.
  - Portability: export `maps` (background image as a data URL, as today).
  - Import ignores `edges`, `battleMaps` and saved-encounter `map`.
- **Removed:** the World Map panel and its edge form, the party travel list and pace picker, the `src/travel` module, the Battle Map panel, and the battleMaps and edges storage modules.
- **Keyboard:** drawing, Markers and point editing are pointer-only. Tokens keep their arrow keys. Delete/Backspace removes the selection when focus isn't in a field. Esc cancels an in-progress Line, and only then goes back to the Dashboard.
  - These shortcuts go through the shortcut registry, which ignores key presses while the DM types or a dialog is open.
- **Draw order:** background, grid, Area fills, Lines/Walls/Doors/Routes, Markers, Tokens, ruler, selection handles. Text and strokes counter-scale with zoom, as both maps do today.

## Testing Decisions

- Tests check what the DM sees and can do, not internal state: map names in the picker, labels and lengths on the canvas, aria-labelled elements, and what is persisted after a reload of the app seam.
- **Seam 1 (main): the whole app on in-memory IndexedDB, driven like a user (Vitest + Testing Library).** Prior art: the BattleMap, BattleMapCombat, BattleMapBackground and WorldMap tests, which are rewritten against the Map panel. It covers:
  - map create/rename/delete/scale/grid;
  - Area and Marker editing through the selection editor;
  - Location linking and deletion fallout;
  - the Encounter map choice and blank-map creation;
  - the Party Token setting the party location;
  - saved encounter save/load;
  - export/import and the migration (open an old-version DB with edges and battleMaps, upgrade, assert they're gone and Locations survive).
- **Seam 2: Playwright** for what jsdom can't do: clicking points to draw, closing a Shape on its first point, double-click to finish, dragging points, Markers and Tokens. Prior art: `e2e/battle-map.spec.ts`, which is rewritten.
- **Seam 3: geometry module unit tests**: snapping, length with units, point-in-polygon (including concave shapes and overlap choice), hit testing. Prior art: the `src/battle` measure and speed tests.
- Load-flaky suites run sequentially as today. No snapshot tests of SVG markup.

## Out of Scope

- Walls or Doors blocking Token movement or line of sight, and fog of war or vision.
- Freehand drawing, and preset rectangle or circle shapes.
- A keyboard path for drawing and Marker placement.
- Travel time, pace, terrain on Routes, and the "travel from party location" list.
- Any conversion of old World Map or Battle Map data (ADR 0002).
- Uploaded or emoji Marker icons.
- A player-facing view, or Map layers and hiding things from players.
- Multiple Party Tokens, or one Party Token shared across Maps.

## Further Notes

- Suggested ticket slices, each a tracer bullet:
  1. Map record, migration, portability, and a Map panel with picker, scale, grid and background (replacing both panels).
  2. Tokens, ruler and the Encounter link (Combat works again on the new panel), plus saved encounters.
  3. Draw tool: Lines, Shapes, point editing, Wall/Door segments.
  4. Areas with Location links.
  5. Markers with icons and Location links.
  6. Routes with length.
  7. Party Token.
- Slice 2 must land right after slice 1, so Combat is never without a map.
- The open question "Battle Map only exists during an Encounter" in PROJECT_NOTES is answered by this spec.
