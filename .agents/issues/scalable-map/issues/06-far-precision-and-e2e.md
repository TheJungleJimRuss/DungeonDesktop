# 06: Precision far from the start point, and e2e

**What to build:** Drawing, Token moves and the grid stay exact however far the view is from (0, 0). The SVG is drawn relative to an anchor near the view centre (world minus the anchor), so the browser's single-precision transforms never see huge numbers. Stored data stays absolute. Playwright covers smooth Cmd/Ctrl + wheel zoom (the point under the pointer stays still), drawing a wall and dragging a Token 1,000,000 squares from the start point landing on the grid, and no grid jump during an animated + step. See spec 0009 "Coordinates and scale" and "Testing Decisions".

**Blocked by:** 02, 03.

**Status:** done

- [x] Rendering is relative to the view anchor. Pointer-to-world conversion adds the anchor back. A unit test covers the offset maths.
- [x] The e2e specs above pass (existing map e2e specs are updated for the new Map shape).
- [x] All unit and whole-app tests pass. tsc is clean.
