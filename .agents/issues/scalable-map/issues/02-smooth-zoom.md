# 02: Smooth zoom with a crossfading grid

**What to build:** Zoom is continuous. Wheel, trackpad pinch and Cmd/Ctrl + wheel zoom about the pointer with no snapping. The + and − buttons and keys animate a fixed step over about 150 ms with easing (instant under prefers-reduced-motion). The grid uses the 1, 2, 5 × 10ⁿ ladder in feet up to 500 ft, then in miles. Two neighbouring steps are drawn with crossfaded opacity, so the grid never jumps. The label, the scale bar and snapping (drawing, ruler half-steps, Area drags) follow the more visible step. See spec 0009 "Grid".

**Blocked by:** 01.

**Status:** done

- [x] Today's zoom snapping (snapZoom/snapGridValue) is removed. Zoom is continuous within the clamp.
- [x] A pure ladder function returns the two steps and their weights for any pxPerSquare, correct across the ft/mi switch (unit-tested).
- [x] The grid draws both steps with the weights. The label is always a round value from the ladder.
- [x] +/− animate and land on step × 1.5 (or the spec's step). The zoom readout updates.
- [x] Snapping uses the dominant step.
- [x] Tests pass. tsc is clean.
