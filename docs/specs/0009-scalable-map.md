# 0009 Scalable Map: one endless Map from continent to battle square

Status: draft (2026-11-25), waiting for approval
Source: user request 2026-11-25 ("I want the maps to smoothly scale between small scale and large scale maps, so ideally you only need one map.")
Decision record: ADR 0003 (fixed 5 ft base square, endless canvas, fresh start)

## Problem Statement

A Map today is a fixed grid of at most 200 × 200 squares at one scale ("1 square = 5 ft" or "1 square = 6 mi"). A world, a city and a dungeon each need their own Map, because a Map that's big enough for a continent can't be drawn in at battle detail, and the reverse is also true. The DM keeps several Maps and jumps between them, and nothing on one Map relates to anything on another. Zoom has no limit, but it moves in steps of 1.5×. Zoomed out, Markers pile up at full size, and room Markers bury the city names.

## Solution

A Map is an endless canvas whose base square is always 5 ft. The DM zooms smoothly from a whole continent down to one battle square. The shown grid relabels itself to round sizes (5 ft, 50 ft, 1 mi, 10 mi …) and fades from one size to the next instead of jumping. Things too small to see fade out on their own: short walls, small Areas and Tokens. Each Marker remembers the zoom it was placed at and fades by its **Priority**: Minor, Normal, Major or Always. A city stays visible on the continent, while a chest shows only near its room. The Party Token never fades. An Encounter starts where the DM is looking, zoomed in to battle scale. "Fit all" shows everything drawn. A Campaign can still have several Maps, but one is enough. Background images are removed for now. Existing Maps are deleted by the upgrade (ADR 0003).

## User Stories

### Endless canvas
1. As a DM, I want a Map to have no edges, so that I can keep drawing outward as the world grows.
2. As a DM, I want to pan in any direction without limit, so that I never hit the edge of the world.
3. As a DM, I want a new Map to open at battle scale, so that I can start drawing a room right away.
4. As a DM, I want a Map to reopen at my last view on this device, so that I come back to where I was.
5. As a DM, I want a "Fit all" button that zooms to show everything drawn on the Map, so that I can find my way back after getting lost.
6. As a DM, I want "Fit all" on an empty Map to go back to battle scale at the start point, so that the button always does something sensible.
7. As a DM, I want the Map settings to have no width, height, scale or unit fields, so that there is nothing about size to manage.
8. As a DM, I want to keep the Show grid checkbox, so that I can still hide the grid on a world view.
9. As a DM, I want precise drawing and Token moves however far I've panned from the start, so that a dungeon 3,000 miles away works as well as one at the start point.

### Smooth zoom
10. As a DM, I want the wheel, trackpad pinch and Cmd/Ctrl + wheel to zoom smoothly about the pointer, so that zooming feels like a real map app.
11. As a DM, I want the + and − buttons and keys to animate a fixed step, so that I can see where I'm going.
12. As a DM, I want zoom to go from a continent (thousands of miles in view) down to a few squares, so that one Map covers every scale (limits: about 47,000 mi across the view, out to one square filling it).
13. As a DM, I want the zoom readout to tell me what's in view in plain terms (for example "1 square = 10 mi"), so that I know what scale I'm at.
14. As a DM, I want the grid always labelled with a round size (5 ft, 10 ft, 50 ft, 100 ft, 500 ft, 1 mi, 5 mi, 10 mi …), so that I can read distances at a glance.
15. As a DM, I want the grid to fade smoothly from one round size to the next as I zoom, so that it never jumps.
16. As a DM, I want the scale bar to follow the grid, so that the two always agree.
17. As a DM, I want distances to switch from feet to miles on their own (from 1,000 ft), so that I never pick a unit.

### Fading by size
18. As a DM, I want a Line, Wall or Door to fade out when it's only a few pixels long on screen, so that dungeon walls don't blur the continent.
19. As a DM, I want an Area to fade out when it's only a few pixels across on screen, so that small rooms vanish at world zoom.
20. As a DM, I want an Area's name to hide before the Area does, when the name no longer fits inside it, so that labels don't spill over their neighbours.
21. As a DM, I want ordinary Tokens to fade out when their square is too small to see, so that monsters don't speckle the world view.
22. As a DM, I want things to fade, not pop, so that zooming stays calm.
23. As a DM, I want faded things to be unselectable and not to catch clicks, so that I don't grab a hidden wall by accident.
24. As a DM, I want what I'm drawing or dragging to stay visible even if it would fade at this zoom, so that I can see my own work.

### Marker Priority
25. As a DM, I want each Marker to remember the zoom it was placed at, so that its fading is relative to the scale it belongs to.
26. As a DM, I want to set a Marker's Priority to Minor, Normal, Major or Always, so that I choose how far out it stays visible.
27. As a DM, I want Minor to stay visible up to 3× further out than its placing zoom, so that chests and traps vanish quickly.
28. As a DM, I want Normal (the default) to stay visible up to 10× further out, so that rooms and buildings show around their dungeon or town.
29. As a DM, I want Major to stay visible up to 100× further out, so that towns show on the regional view.
30. As a DM, I want Always never to fade, so that capitals show on the whole continent.
31. As a DM, I want Markers to stay fully visible when I zoom in past their placing zoom, so that zooming in never hides anything.
32. As a DM, I want a "Set to this zoom" button in the Marker editor, so that I can re-anchor a Marker that I placed at the wrong scale.
33. As a DM, I want the Priority shown in the Marker editor, so that I can see why a Marker hides.

### Party Token
34. As a DM, I want the Party Token never to fade, so that I can see the party on the continent.
35. As a DM, I want the Party Token to stay at a minimum on-screen size when its square gets too small, so that it reads like a Marker when I'm zoomed out.
36. As a DM, I want dropping the Party Token on a linked Marker or Area to still set the party's location at any zoom, so that travel tracking works on the world view.
37. As a DM, I want the Party Token to drop on the nearest whole square, so that it lands where I let go, not on a snapped point miles away.

### Tokens, ruler, Routes
38. As a DM, I want Tokens to be 5 ft squares on every Map, so that battles always use the standard D&D grid.
39. As a DM, I want the ruler to measure in feet or miles from the 5 ft base, so that it works at every zoom.
40. As a DM, I want the ruler to snap to the shown grid's corners, centres and edge midpoints at every zoom, as it does today.
41. As a DM, I want a Route's length to read in feet or miles from the 5 ft base, so that travel distance is right without setting a scale.
42. As a DM, I want drawing to keep snapping to the shown grid at every zoom, so that a world-scale coast snaps to miles and a wall to feet.

### Encounters
43. As a DM, I want starting an Encounter on a Map to use the spot in view, so that the fight happens where I'm looking.
44. As a DM, I want starting an Encounter zoomed out past battle scale to zoom in to battle scale at that spot, so that the battle grid is ready.
45. As a DM, I want an Encounter started zoomed in at battle scale or closer to keep my view, so that nothing jumps.
46. As a DM, I want new Tokens for Combatants placed near the Encounter's spot, so that they don't land at the Map's start point.
47. As a DM, I want a saved Encounter to remember its spot, so that loading it opens the fight where it was.
48. As a DM, I want switching to Combat with a running Encounter to show its spot, so that I can see the fight.
49. As a DM, I want a saved Encounter whose Map was deleted to load onto a new blank Map, as it does today when a Map is missing.

### Find
50. As a DM, I want Find to go to a Marker at its placing zoom, so that I see it in context.
51. As a DM, I want Find to go to an Area or Line zoomed to fit it, so that the whole thing is in view.
52. As a DM, I want Find to go to a Token at battle scale, so that I can see it.

### Images removed
53. As a DM, I no longer see background image controls, so that there's nothing that doesn't work at every scale.

### Upgrade
54. As a DM, I want to be told plainly that this upgrade deletes existing Maps, so that I can export a Campaign first if I care.
55. As a DM, I want everything else (Locations, NPCs, Encounters, Party, notes) kept, so that only the Maps start over.
56. As a DM, I want importing an old Campaign export to skip its old Maps instead of failing, so that old backups still load.

## Implementation Decisions

### Coordinates and scale
- A Map's world coordinates are in **base squares** (1 square = 5 ft), the unit Lines, Markers and Tokens already use. Coordinates are unbounded doubles and can be negative.
- The view is `{ centre, pxPerSquare }`: on-screen pixels per base square. It replaces today's `{ zoom, centre }`, which was relative to the fitted Map size. **Battle scale** is a named constant in pixels per square (about one Token's size today). The view is stored per Map on this device, as now. Old stored views are ignored.
- Zoom is clamped so that one square ranges from 1/10,000,000 of a pixel (about 47,000 mi across a 1,000 px view, room for a world bigger than Earth) to 1,000 pixels (one square fills the view).
- Rendering must stay precise far from the start point. The SVG is drawn relative to the view centre (world coordinates minus the centre, rounded to a nearby anchor), so the browser's single-precision transforms never see huge numbers. Stored data stays in absolute squares.

### Map record
- `unit`, `perSquare`, `width`, `height` and `background` are dropped from the Map record. `showGrid`, `lines`, `markers`, `tokens` and `partyToken` stay.
- A Marker gains `placedAt` (the view's pixels per square when it was placed) and `priority: "minor" | "normal" | "major" | "always"` (default `"normal"`).
- Every distance formatter takes squares and returns ft or mi with the existing 1,000 ft switch. `distanceUnits` and the Route length read the fixed 5 ft.

### Grid
- The grid ladder is the 1, 2, 5 × 10ⁿ series in feet up to 500 ft, then in miles (1, 2, 5, 10 … mi), so labels stay round. The finer ladder used today (halves up to 10, then tens …) collapses into this series.
- Two neighbouring ladder steps are drawn at once, with crossfaded opacity set by where the zoom sits between them, so the grid never jumps. The label and the scale bar follow whichever step is more visible. Snapping (drawing, ruler half-steps, Area drags) uses that same step.
- Zoom itself is continuous. Today's snap-to-a-round-grid-value zoom is removed. The +/− steps animate over about 150 ms with easing, and stop at once under `prefers-reduced-motion`.

### Fading (pure functions in the map geometry module)
- `fadeBySize(screenPx, minPx)` returns an opacity from 0 to 1, ramping across a small band above `minPx`, so things fade rather than pop. Defaults: Line or segment length about 4 px, Area bounding size about 6 px, Token square about 3 px, and Area label width against the Area's on-screen width.
- `markerOpacity(placedAt, pxPerSquare, priority)` is 1 while `placedAt / pxPerSquare` is at or below the Priority's factor (Minor 3, Normal 10, Major 100, Always ∞), then ramps to 0 over the next 1.5×.
- Anything at opacity 0 is not rendered and is skipped by hit testing and Find highlights. The item being drawn, dragged or selected is always drawn at full opacity.
- The Party Token is never faded. Below a minimum on-screen size it is drawn at that size in on-screen pixels (the same `--ui` counter-scale Markers use).
- Off-screen culling: only Lines, Areas, Markers and Tokens whose bounds meet the view are rendered, so a continent of dungeons stays fast.

### Fit all
- "Fit all" computes the bounds of every Line point, Marker, Token and the Party Token, pads them and sets the view to fit. With nothing drawn, it goes to battle scale at (0, 0). New Maps open at battle scale at (0, 0).

### Encounters
- An Encounter and a SavedEncounter gain `spot?: { x, y }` (squares). `startEncounter` takes the current view's centre. When the view is zoomed out past battle scale, the Map view is set to battle scale at that spot. Combatant Tokens are placed with the existing free-square search starting from the spot instead of the Map's start point. Switching to Combat with a running Encounter shows its spot at battle scale unless this device already has a view for that Map.
- Starting an Encounter has no Map view in two cases: from the Initiative tracker with the Map panel closed, or with a brand-new blank Map. Then the spot is the device's last view centre for that Map, or (0, 0) if there is none.

### Find
- Find targets carry a fit rule. Markers go to their `placedAt` zoom (never zooming out past the current view if that would fade it). Lines and Areas go to their fitted bounds. Tokens and the Party Token go to battle scale.

### Settings UI
- Map settings keep only Name, Show grid and Delete. The Map summary text becomes the grid label in view (for example "1 square = 10 mi").
- The Marker editor gains a Priority select (Minor, Normal, Major, Always) and a "Set to this zoom" button.

### Upgrade (ADR 0003)
- DB version 9 clears the `maps` store and drops `mapId`, `tokens` and `spot` from every in-progress and saved Encounter. A saved Encounter with no Map loads onto a new blank Map, as it already does. The per-device last-Map and Map-view keys are cleared.
- Campaign export writes the new Map shape. Import skips Maps that have `perSquare` or `width` (the old shape) instead of failing. The Encounter `mapId` link is dropped when its Map was skipped.
- Before the upgrade runs, the app shows a one-time notice that old Maps are deleted, with an Export button. It uses the existing role="dialog" pattern and is shown only when old Maps exist.

## Testing Decisions

Good tests check what the DM sees and does, not internal state: drive the app as a user and assert on what's on screen and in storage. The same three seams as spec 0007, nothing new:

- **Whole-app tests on in-memory IndexedDB** (prior art: the MapPanel, MapEncounter, MapTokens and portability tests): no size or scale fields in Map settings; Fit all on an empty and a drawn Map; zoom readout and grid label after +/−; Marker Priority select and "Set to this zoom"; a Marker hides after zooming out past its Priority, and Always never hides; the Party Token stays after zooming far out; starting an Encounter zoomed out places Tokens near the view's spot at battle scale; a saved Encounter loads at its spot; Find goes to each target type; the version 9 upgrade clears Maps and keeps the rest; importing an old export skips old Maps.
- **Pure geometry and scale unit tests** (prior art: the map geometry, lines and find tests and the battle measure tests): the grid ladder and crossfade weights across the ft/mi switch; `fadeBySize` bands; `markerOpacity` for each Priority, below and above its factor; Fit all bounds; far-from-start rendering offsets; distance formatting from squares.
- **Playwright, real browser only** (prior art: the map-draw, map-markers and battle-map e2e specs): smooth Cmd/Ctrl + wheel and pinch zoom keep the point under the pointer still; drawing a wall and dragging a Token 1,000,000 squares from the start point lands exactly on the grid; the grid and labels have no jumps during a + animation (two screenshots mid-step).
- Existing Map tests that set width, height, scale or background are rewritten or removed with the features they covered.

## Out of Scope

- Background images of any kind, including several placed images. They're removed now and may come back as a later spec.
- Per-item zoom ranges for Lines, Areas or Tokens. Only Markers get a Priority. The rest fade by size alone.
- Hiding by overlap (decluttering Markers that collide on screen).
- Links between Maps, sub-Maps or nested Maps.
- Converting old Maps (ADR 0003 explains why).
- Raster tiling, or level-of-detail simplification of very long Lines.
- A keyboard path for the ruler (an open question already).

## Further Notes

- Glossary updated 2026-11-25: Map (endless, fixed 5 ft base square), Marker (remembers its placing zoom), Priority (new), Party Token (never fades) and Encounter (its spot).
- Suggested slices: (1) record and upgrade, view as pixels per square, endless pan, drop the size, scale and image settings, Fit all; (2) continuous zoom with the crossfading grid ladder and animated +/−; (3) fading by size plus culling; (4) Marker Priority; (5) Party Token minimum size; (6) Encounter spot and Find fit rules; (7) far-from-start precision and e2e.
- This repo has no `docs/agents/issue-tracker.md`. Specs are local files here, as with 0001–0008.
