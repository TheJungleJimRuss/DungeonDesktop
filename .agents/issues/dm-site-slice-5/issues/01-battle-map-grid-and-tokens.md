# 01: Battle Map grid and free tokens

**What to build:** Replace the "battle-map" placeholder with a real Battle Map panel in Combat mode: an SVG grid of adjustable width x height (squares) and feet per square (default 5), with tokens (name, colour, grid position) the DM adds, edits, deletes and moves by pointer drag (snaps to squares) or arrow keys when selected. A new per-Campaign `battleMaps` collection (DB v6, added to export/import) holds one map per Encounter (keyed by encounterId); saving an encounter composition stores a copy of its map and restoring one copies it back. Pop-out capable and live-synced. Covers stories 70, 71, 72, 78, 80, 81.

**Blocked by:** none

**Status:** done

- [x] Grid with adjustable size and feet per square, persisted per Encounter
- [x] Add/edit/delete free tokens (name, colour); drag and arrow-key moves snap to squares
- [x] `battleMaps` collection (DB v6), older DBs upgrade, included in export/import
- [x] Saved encounters carry their map; restoring brings it back
- [x] Own panel, pop-out capable, syncs across windows
- [x] Whole-App test (keyboard moves); Playwright e2e for pointer drag and Pop-out sync
