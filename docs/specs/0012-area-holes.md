# 0012 Area holes (Subtract shape)

Status: approved 2026-11-26
Source: user request 2026-11-26. Areas are single filled outlines, so a donut, a courtyard or a room with a pillar
can't be drawn as one Area.

## Problem Statement
An Area on a Map is one filled outline. The DM can't leave part of it unfilled: a ring-shaped moat, a forest with a
clearing, a room with a pillar or a town around a lake all need the fill to stop somewhere inside the Area, or the
outline to bend around something that is already drawn. Today the only workaround is to draw awkward slit-shaped
outlines by hand, and clicking the "empty" middle still selects the Area.

## Solution
The DM selects an Area, presses **Subtract shape** in its Area editor and clicks another Shape or Area (the cutter).
The cutter stays on the Map; its inside is cut out of the Area:

- A cutter fully inside the Area leaves a **Hole**: no fill there, and clicks there go to whatever is underneath.
- A cutter across the Area's edge leaves a **Notch**: the outline is rewritten to bite around the cutter. The Map
  previews the result and asks "Cut notch?" first, because there is no Undo.
- A cut that would split the Area in two, remove all of it, or doesn't touch it is refused with a short message. So is one that would leave a Hole touching the outline at a single point, or an outline or Hole touching itself ("touches the edge").

Holes are fill-only (no walls or doors). While the Area is selected its Holes show their edges and point handles:
points can be dragged, and a Hole can be selected (click its edge) and removed (button or Delete). Holes that come to
overlap merge into one. Dragging a Hole (or the outline) so the Hole crosses the outline turns it into a Notch, with
the same preview and confirm; a drag that would split the Area snaps back.

## User Stories
1. As a DM, I want to cut a Shape out of an Area, so that the Area can have an unfilled middle (a donut, a courtyard).
2. As a DM, I want to start a cut from the selected Area's editor with "Subtract shape", so that it's clear which Area is being cut.
3. As a DM, I want a status line telling me to click the Shape to cut with, so that I know what the Map is waiting for.
4. As a DM, I want Esc to cancel Subtract shape before I click a cutter, so that I can back out.
5. As a DM, I want any closed Shape or another Area to work as the cutter, so that I can cut a lake Area out of a forest Area.
6. As a DM, I want Routes and open Lines refused as cutters, so that nothing odd happens when I misclick.
7. As a DM, I want the cutter to stay on the Map, so that a pillar drawn with walls keeps its walls and also cuts the floor's fill.
8. As a DM, I want a cutter fully inside the Area to become a Hole straight away, so that the common case is one click.
9. As a DM, I want the Hole drawn as empty (Map and grid visible through it), so that the Area reads as a ring.
10. As a DM, I want a click inside a Hole not to select the Area, so that I can select or pan what is underneath.
11. As a DM, I want a smaller Area sitting inside a Hole to be selectable, so that nested Areas still work.
12. As a DM, I want the Party Token dropped inside a Hole not to count as being in the Area, so that the party location stays truthful.
13. As a DM, I want "the smallest Area under the pointer wins" to count the Area's size without its Holes, so that a thin ring doesn't beat what it surrounds.
14. As a DM, I want the Area's name placed on the filled part, not in a Hole, so that the label stays on the Area.
15. As a DM, I want a cutter that crosses the Area's edge to notch the outline, so that I can bite a shape out of a room or coastline.
16. As a DM, I want to see the notched result before it is saved and confirm "Cut notch?", so that a misclick doesn't permanently rewrite my outline.
17. As a DM, I want "No" on the notch confirm to leave the Area unchanged, so that I can cancel safely.
18. As a DM, I want the outline's existing wall/door/plain segments to keep their kind after a notch, so that my walls aren't lost.
19. As a DM, I want the notch's new segments to be plain, so that I set walls on them myself like any segment.
20. As a DM, I want a cut that would split the Area into separate pieces refused with a message, so that one Area stays one outline.
21. As a DM, I want a cut that would remove the whole Area refused with a message, so that I don't lose the Area by accident.
22. As a DM, I want a cutter that doesn't overlap the Area refused with a message, so that I know nothing happened.
23. As a DM, I want a new cut overlapping an existing Hole to merge with it, so that Holes never overlap.
24. As a DM, I want a cut that touches both a Hole and the edge to become one Notch, so that the result is what I see.
25. As a DM, I want Hole edges shown only while the Area is selected, so that unselected Areas look clean.
26. As a DM, I want point handles on a selected Area's Holes, so that I can reshape a Hole.
27. As a DM, I want Hole point drags to snap like outline point drags, so that Holes line up with the grid.
28. As a DM, I want Holes that come to overlap after a drag to merge, so that the Area stays valid.
29. As a DM, I want a drag that pushes a Hole across the outline to become a Notch after the same preview and confirm, so that dragging behaves like cutting.
30. As a DM, I want an outline point drag that pulls the outline across a Hole treated the same way, so that either direction works.
31. As a DM, I want a drag that would split the Area to snap back with a message, so that the Area stays whole.
32. As a DM, I want to select a Hole by clicking its edge, so that I can act on just that Hole.
33. As a DM, I want "Remove hole" and Delete to remove only the selected Hole, so that I don't delete the Area by mistake.
34. As a DM, I want dragging the Area to move its Holes with it, so that the shape stays intact.
35. As a DM, I want Unmake area to drop the Holes along with the fill, so that a plain Shape has no leftovers.
36. As a DM, I want an Area's Holes saved with the Map and in Campaign export/import, so that they persist.
37. As a DM, I want Maps saved before this change to load unchanged, so that nothing I drew is lost.
38. As a DM, I want an Area with Holes to fade out and hide its label at the same zoom as before, so that zooming feels the same.
39. As a DM, I want Fit all to frame Areas by their outline as before, so that Holes don't change framing.

## Implementation Decisions
- **Data**: an Area gains an optional list of Holes, each a ring of points in squares (world coordinates, like the
  outline). Absent means none, so stored Maps and Campaign JSON load unchanged: no DB version bump, no migration.
  Holes live on the Area (not the Line), so Unmake area drops them.
- **Invariant**: after every save, each Hole is strictly inside the outline, Holes don't overlap each other, and the
  outline is one simple ring. All cut and drag paths go through one pure function that enforces it.
- **Pure cut module** (in the map geometry area, tested alone): given an Area's outline (with segment kinds), its
  Holes and a cutter ring, returns one of: `hole` (new Holes list), `notch` (new outline + segment kinds + Holes),
  `split`, `erase`, `miss` or `touch` (a Hole or outline would touch an edge at a point; added during build). The same function "normalises" an Area after a point drag (subtract each Hole from the
  outline; a Hole no longer strictly inside becomes a Notch). Results round to 6 decimals like snapping.
- **Clipping**: bundle the MIT `polygon-clipping` library (no runtime fetch) for difference/union. A result with more
  than one polygon is `split`, none is `erase`, no change is `miss`.
- **Segment kinds after a Notch**: each new outline edge lying along an old outline edge keeps that edge's kind;
  any other edge is plain.
- **Geometry helpers** become Hole-aware: point-in-Area is inside the outline and in no Hole; Area size for the
  smallest-wins pick is outline minus Holes; the label point is searched on the filled part. Fading, culling and
  Fit all keep using the outline's bounds.
- **Rendering**: the Area fill is one path (outline plus Hole rings) with `fill-rule="evenodd"`, so Holes neither
  draw nor take clicks. Hole edges and their point handles draw only while the Area is selected.
- **Subtract shape**: a button in the Area editor puts the Select tool into a "subtract" state with a status line;
  the next click on a Shape or Area (via the existing Line/Area hit tests) is the cutter; Esc or clicking empty Map
  cancels. Notch results show a preview of the new outline with "Cut notch?" Yes/No (role="dialog"-free inline
  confirm, like End encounter's two-step confirm). Refusals show in the status line.
- **Hole selection**: with the Area selected, a click on a Hole's edge selects that Hole (one at a time); the Area
  editor then shows "Remove hole", and Delete removes the Hole instead of the Area. Esc steps back from Hole to Area
  selection.
- **Point drags**: Hole handles reuse the outline handles' drag and snapping. On release the Area is normalised:
  merges just save; a Notch shows the preview and confirm (No restores the pre-drag Area); split/erase snaps back
  with a message.
- **Area drag** shifts the Holes with the outline.

## Testing Decisions
- Good tests drive behaviour from the outside: pure inputs and outputs for geometry, and the whole app driven like a
  user for the Map. No tests of component internals.
- **Geometry unit tests** (prior art: the existing geometry and lines tests): hole / notch / split / erase / miss;
  cutter touching the edge or sharing an edge with the outline (grid-aligned cases); merging overlapping Holes; cut
  over a Hole and the edge becoming one Notch; segment kinds kept on surviving edges, plain on new ones;
  normalise after a drag (Hole escapes -> Notch, Holes overlap -> merge, split refused); point-in-Area with Holes;
  Area size minus Holes; label point not in a Hole.
- **Whole-app jsdom tests** (prior art: the Map Areas and Map Party tests): Subtract shape with a Shape and with an
  Area as cutter (cutter kept); Hole renders as an evenodd path; click inside a Hole doesn't select the Area and does
  select a smaller Area there; notch confirm Yes/No; refusal messages; Remove hole and Delete on a selected Hole; Esc
  steps; Unmake area drops Holes; Party Token in a Hole sets no location; a Map stored without holes still loads.
- **Playwright** (prior art: map-draw spec and map helpers): dragging a Hole point; a drag that turns a Hole into a
  Notch with the confirm; a drag that would split snaps back. The existing e2e map specs must still pass.

## Out of Scope
- Holes on plain Shapes (no fill to cut).
- Walls or doors on Hole edges; Tokens, sight and movement still ignore all walls.
- Splitting an Area into several Areas; multi-piece Areas.
- Adding or removing points on a Hole (drag only); drawing a Hole directly without a cutter.
- Union/merge of two Areas, intersect, or any other boolean operation.
- Undo on the Map.

## Further Notes
- Glossary terms added: Subtract shape, Hole, Notch (and Area now mentions Holes).
- The Map draws relative to an anchor and Chrome stops drawing beyond ~1e7 SVG units (see project notes): Hole rings
  must go through the same anchor conversion and units-per-square scaling as the outline.
- Ticket split will likely be: (1) data + pure cut module + Hole-aware hit test/size/label + evenodd rendering,
  (2) Subtract shape with Hole and Notch confirm, (3) Hole selection, Remove hole and Delete,
  (4) Hole point drags with normalise, (5) e2e.
