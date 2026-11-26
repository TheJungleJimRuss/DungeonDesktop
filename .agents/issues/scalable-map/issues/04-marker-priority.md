# 04: Marker Priority

**What to build:** Each Marker remembers the view's pixels per square when it was placed (placedAt) and has a Priority: Minor (3×), Normal (10×, the default), Major (100×) or Always (never fades). A Marker is fully visible while placedAt / pxPerSquare is at or below its factor, then fades to 0 over the next 1.5×. Zooming in never hides it. The Marker editor shows a Priority select and a "Set to this zoom" button that re-anchors placedAt. See spec 0009 "Fading" and user stories 25–33.

**Blocked by:** 01.

**Status:** done

- [x] MapMarker gains placedAt and priority (default normal). New Markers record the current pxPerSquare.
- [x] Pure markerOpacity(placedAt, pxPerSquare, priority) is unit-tested for each Priority below, at and above its factor.
- [x] Faded Markers aren't rendered or hit. A selected Marker stays visible.
- [x] The editor's Priority select and "Set to this zoom" persist (whole-app test: zoom out past Normal and it hides, Always stays).
- [x] Tests pass. tsc is clean.
