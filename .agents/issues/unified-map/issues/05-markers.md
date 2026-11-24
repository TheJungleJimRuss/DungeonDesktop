# 05: Markers

Spec: docs/specs/0007-unified-map.md (stories 35-41).

**What to build:** A Marker tool places a Marker where the DM clicks. A Marker is placed freely (no snapping) and is draggable. It has a name, color, short note and an icon from a fixed bundled set of about 12 inline SVGs (pin, city, camp, cave, skull, chest, door, tower, temple, tavern, ship, star), and works offline. Selecting a Marker shows its editor, including the note. A Marker may link to an existing Location or create one. A linked Marker shows the Location's live name, and selecting it selects the Location. Deleting a Location unlinks its Markers and keeps the old name. Markers draw above Lines and below Tokens.

**Blocked by:** 01

**Status:** done (2026-11-23)

- [x] Placing a Marker and editing its name, color, icon and note all persist. Delete removes it.
- [x] Playwright: place by click, drag freely (fractional position kept).
- [x] Location link and create, the live name, the selection follow-through, and the deletion fallout.
