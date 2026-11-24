# 07: Party Token

Spec: docs/specs/0007-unified-map.md (stories 48-50).

**What to build:** "Add party token" puts the single optional Party Token on the current Map (at most one per Map). It is distinct from other Tokens, snaps to squares and is draggable or moved with the arrow keys. When it is dropped on a Marker linked to a Location (within the hit radius) or inside an Area linked to a Location, the campaign's party location is set to that Location. When several linked Areas overlap, the smallest wins, and a Marker beats an Area. Removing the Party Token leaves the party location unchanged.

**Blocked by:** 02, 04, 05

**Status:** done (2026-11-23)

- [x] Only one Party Token per Map, and the Add button hides while one is present.
- [x] Moving it into a linked Area, or onto a linked Marker, sets the party location. Overlap picks the smallest Area, and a Marker wins over an Area.
- [x] Removing it keeps the party location as it was.
