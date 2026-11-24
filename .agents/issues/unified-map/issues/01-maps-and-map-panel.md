# 01: Maps and the Map panel (Explore)

Spec: docs/specs/0007-unified-map.md (stories 1-12, 57-59 for World Map data). ADR 0002.

**What to build:** The DM can create any number of named Maps in a Campaign and work with them in a new Map panel, which replaces the World Map panel in Explore mode (and on saved Dashboards). Each Map has a name, scale (1 square = N ft or N mi), grid show/hide, width × height in squares and an optional background image (scale, offset). The panel has a Map picker with New, Rename and Delete (with a confirm step), zoom/pan with the view saved per Map on this device, and opens the last viewed Map. Maps sync across tabs and are included in campaign export/import, with background images as data URLs. A DB version bump creates `maps`, deletes the `edges` store and strips `x`/`y` from Locations. The World Map panel, the edge code, the travel list, the pace picker and `src/travel` are removed. The Battle Map is NOT touched in this ticket.

**Blocked by:** None (can start immediately)

**Status:** done (2026-11-23)

- [x] Create, rename and delete a Map through the panel. Delete needs a confirm. The picker lists Maps by name.
- [x] Scale unit and number, grid toggle, and width/height persist and survive a reload. Grid size inputs commit on blur/Enter.
- [x] Background image upload, scale and offset work on a Map (reuse today's image storage and resizing).
- [x] The last viewed Map reopens. The panel's empty state offers "New map".
- [x] Explore mode layout and saved Dashboards that named `world-map` now show `map`.
- [x] The upgrade test: a DB at the old version with edges and Location x/y is upgraded, `edges` is gone, `x`/`y` are gone, and Locations, NPC links and the party location are intact.
- [x] Export/import round-trips Maps with an image. Importing an old export that has `edges` doesn't fail and ignores them.
- [x] The WorldMap tests are replaced by Map panel tests on the app seam. `npx tsc --noEmit` is clean and the full Vitest suite passes.
