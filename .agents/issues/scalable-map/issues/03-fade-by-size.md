# 03: Fade by size, culling, and a Party Token that never fades

**What to build:** Lines (each segment), Walls and Doors fade when they're under about 4 px long on screen. Areas fade under about 6 px across. An Area's name hides when it no longer fits inside the Area. Tokens fade when their square is under about 3 px. Fading ramps over a small band and never pops. Faded items aren't rendered or hit-tested. The item being drawn, dragged or selected is always full opacity. Only items whose bounds meet the view are rendered. The Party Token never fades: below a minimum on-screen size it's drawn at that size in on-screen pixels, it still drops on the nearest whole square, and it still sets the party location on linked Markers and Areas at any zoom. See spec 0009 "Fading" and user stories 18–24 and 34–37.

**Blocked by:** 01.

**Status:** done

- [x] Pure fadeBySize(screenPx, minPx) is unit-tested across its band.
- [x] Lines, Areas, Area labels and Tokens fade as described. Opacity 0 means not rendered and not hit.
- [x] Drawing, dragging and selected items stay at full opacity.
- [x] Off-screen culling by bounds.
- [x] The Party Token keeps a minimum on-screen size and never fades. Dropping it on a linked Marker or Area sets the party location when zoomed far out (whole-app test).
- [x] Tests pass. tsc is clean.
