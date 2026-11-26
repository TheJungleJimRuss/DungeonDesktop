# 01: Holes render and click through

**What to build:** An Area can carry Holes (spec 0012). An Area with Holes draws with empty Holes (evenodd fill), a click inside a Hole does not select the Area (a smaller Area there is selectable; empty space pans/deselects), the Party Token dropped inside a Hole doesn't count as in the Area, the smallest-Area pick counts outline minus Holes, and the label sits on the filled part. Dragging the Area moves its Holes; Unmake area drops them. Maps stored without Holes load unchanged (no DB bump). Holes are drawn through the same anchor and units-per-square conversions as the outline.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Area type has optional `holes` (rings of points in squares); absent = none
- [x] Geometry unit tests: point-in-Area with Holes, size minus Holes, label point not in a Hole
- [x] jsdom app tests (Map Areas style, Holes seeded in storage): evenodd path, click in Hole doesn't select, smaller Area in Hole selects, Area drag shifts Holes, Unmake drops Holes, Party Token in Hole sets no location, Map without holes loads
