# 04: Areas

Spec: docs/specs/0007-unified-map.md (stories 25-31, 39, 41).

**What to build:** A selected Shape can be made an Area: a free-text kind, a color and an optional name. It can be linked to an existing Location or create a new Location from the Area's name. Areas draw as a translucent fill under Lines, Markers and Tokens, labelled with their name, or the linked Location's live name. "Unmake area" returns the Area to a plain Shape. Selecting a linked Area selects its Location (the Locations panel follows). Deleting a Location clears `locationId` on linked Areas and keeps the old name as the Area's own name. The same Location may be linked from several Maps.

**Blocked by:** 03

**Status:** done (2026-11-23)

- [x] Make Area, edit kind, color and name, and Unmake all persist. An open Line offers no Make Area.
- [x] Link to an existing Location, and Create Location from an Area. Renaming the Location relabels the Area.
- [x] Deleting a linked Location leaves the Area named with the old name and unlinked.
- [x] Selecting a linked Area selects the Location.
