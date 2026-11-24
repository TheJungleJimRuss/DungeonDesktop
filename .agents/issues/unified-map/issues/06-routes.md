# 06: Routes

Spec: docs/specs/0007-unified-map.md (stories 32-34).

**What to build:** A Route tool draws an open Line flagged as a Route. It draws in a distinct style and is labelled with its total length: segment lengths × the Map's per-square scale, in its unit ("42 mi", "35 ft"). The label updates live while points are dragged and when the Map's scale changes. Routes never close into Shapes and can be edited and deleted like other Lines.

**Blocked by:** 03

**Status:** done (2026-11-23)

- [x] Drawing with the Route tool makes a Route. Clicking its first point doesn't close it.
- [x] The length label is correct for a multi-segment Route in ft and in mi, and updates after a scale change.
- [x] Playwright: dragging a Route point updates the label.
