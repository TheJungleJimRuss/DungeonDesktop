# 02: Subtract shape makes Holes

**What to build:** With an Area selected, "Subtract shape" in the Area editor enters a subtract state with a status line; Esc or a click on empty Map cancels. Clicking a Shape or Area (not a Route or open Line, not the Area itself) uses it as the cutter; the cutter stays. A cutter fully inside makes a Hole, merging with any Hole it overlaps. Refusals (miss, erase, split) show a message in the status line. A cut that would make a Notch is refused for now ("would cut the edge") until ticket 03. Built on a pure cut module using the bundled polygon-clipping library, returning hole / notch / split / erase / miss, rounding to 6 decimals.

**Blocked by:** 01

**Status:** done

- [x] polygon-clipping added as a dependency
- [x] Geometry unit tests for the cut module: hole, notch, split, erase, miss, grid-aligned touching/shared edges, merge with an existing Hole, cut over Hole + edge classified as notch
- [x] jsdom app tests: cut with a Shape and with an Area (cutter kept), refusals, Esc cancels, Routes/open Lines ignored
