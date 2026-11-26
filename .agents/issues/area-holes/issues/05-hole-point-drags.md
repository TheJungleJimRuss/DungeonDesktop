# 05: Hole point drags

**What to build:** With an Area selected, its Hole points get drag handles like the outline's, snapping the same way. On release (Hole or outline point drag) the Area is normalised through the cut module: overlapping Holes merge and save; a Hole crossing the outline becomes a Notch after the same preview and "Cut notch?" confirm (No restores the pre-drag Area); a drag that would split or erase snaps back with a status message.

**Blocked by:** 03, 04

**Status:** done

- [x] Unit tests: normalise (escape -> notch, overlap -> merge, split refused)
- [x] Playwright (map-draw style): drag a Hole point; drag that becomes a Notch with confirm; drag that would split snaps back
- [x] All existing e2e map specs and the full vitest suite pass
