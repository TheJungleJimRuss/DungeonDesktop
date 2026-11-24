# 03: Draw tool: Lines, Shapes, Walls and Doors

Spec: docs/specs/0007-unified-map.md (stories 13-24).

**What to build:** A tool bar on the Map panel (Select, Draw, plus the existing Token and Ruler tools). With Draw, each click adds a point joined by a straight segment, with a preview segment to the cursor. Points snap to grid corners while the grid is shown and are free while it is hidden. Clicking the first point closes the Line into a Shape. Enter or a double-click finishes an open Line, and Esc cancels the Line in progress (Esc only goes to the Dashboard when nothing is being drawn). With Select, clicking a Line or Shape selects it and shows draggable point handles. The inline editor sets each segment to plain, Wall or Door, and Delete removes the selection. Walls draw thick, and Doors draw as a gap with a door mark. Nothing is enforced. A pure geometry module provides snapping, polyline length, point-in-polygon and screen-pixel hit testing. Delete/Backspace and Esc go through the shortcut registry.

**Blocked by:** 01

**Status:** done (2026-11-23)

- [x] Geometry unit tests: snapping, length, point-in-polygon (including a concave shape), segment hit radius.
- [x] Playwright: draw an open Line (double-click), draw a closed Shape (click the first point), and drag a point. The record matches.
- [x] App seam: segment type changes and Delete persist, and Wall and Door render with distinct aria-labels or classes.
- [x] Esc cancels drawing without leaving the Mode. Delete is ignored while typing in a field.
