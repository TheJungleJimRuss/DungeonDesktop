Status: revision 3 (free placement, no snapping; DM decision 2026-11-17). Revision 2 was approved and built; revision 3 changes only the grid and collision rules below. Revision 1 (ordered list with width/height selects) is built and uncommitted; this revision replaces its editing model. Local file; no tracker configured. Label: ready-for-agent

# Customizable Dashboard

## Problem Statement

The Dashboard used to show three fixed panels. Revision 1 let the DM pick panels and set each one's order, width (1/3 to full) and height (normal or tall) with buttons and selects. That still feels rigid: the DM wants to put each panel exactly where they want and make it exactly as big as they want, directly, the way they'd arrange windows.

## Solution

While customizing, the DM drags panels by their title bar and resizes them from their bottom-right corner. Panels move and resize freely in fine steps of about 8 px (no visible snapping) and stay exactly where they are dropped, gaps included. Dragging or resizing a panel onto others pushes them down, so panels never overlap; while the drag or resize goes on, a pushed panel moves back to its spot as soon as nothing covers it. Once dropped, panels stay where they ended up. "Customize Dashboard" / "Done", the "Add panel" picker, "Reset to default" and per-panel "Remove" stay. The move up/down buttons and the width/height selects go away: dragging replaces them. The arrangement is saved per Campaign as before. Modes keep their fixed layouts.

## User Stories

1. As a DM, I want to drag a panel by its title bar to a new spot, so that I can arrange the Dashboard the way I think.
2. As a DM, I want to resize a panel from its corner to any width and height on the grid, so that each panel gets exactly the room it needs.
3. As a DM, I want panels to move and resize smoothly without snapping to coarse steps, so that I can place them exactly.
4. As a DM, I want to see where a panel will land while I drag it, so that I'm never surprised on drop.
5. As a DM, I want panels in the way to move down when I drop onto them, so that nothing overlaps or disappears.
5a. As a DM, I want a panel I pushed while dragging to move back to its spot once I drag past it, so that passing over a panel doesn't rearrange the Dashboard.
6. As a DM, I want panels to stay exactly where I drop them, empty space included, so that gaps I leave on purpose stay.
7. As a DM, I want a minimum panel size, so that I can't shrink a panel until it's unusable.
8. As a DM, I want a panel whose content is taller than its box to scroll inside the box, so that a small panel still shows everything.
9. As a DM, I want dragging and resizing only while customizing, so that a click on a panel mid-game never moves it.
10. As a DM, I want clicks inside a panel (buttons, inputs) to keep working while customizing, so that dragging only starts from the title bar.
11. As a DM, I want "Done" to hide the drag handles and resize corners, so that the Dashboard looks clean during play.
12. As a DM, I want a newly added panel to appear at the bottom at a sensible size, so that adding never disturbs my layout.
13. As a DM, I want "Remove" on each panel while customizing, so that I can take panels away.
14. As a DM, I want the picker to list only panels not on the Dashboard, with one "NPCs" panel, so that I can't add duplicates or choose between near-identical panels.
15. As a DM, I want my arrangement saved per Campaign and kept after a reload, so that I set it up once.
16. As a DM, I want "Reset to default" to restore Session summary, Player card and Pinned notes, so that I can undo experiments.
17. As a DM, I want an empty Dashboard to show a hint to add a panel, so that it isn't confusing.
18. As a DM, I want export, import and duplicate to carry the arrangement, so that a Campaign moves with its setup.
19. As a DM, I want an arrangement I made with revision 1 (widths and heights) to open as the same layout in the new grid, so that I don't lose it.
20. As a DM, I want a damaged or out-of-range layout (bad numbers, unknown panels, overlaps) repaired on load instead of crashing, so that I can always open my Campaign.
21. As a DM, I want keyboard shortcuts to keep working while customizing, and the "Continue in <Mode>" button to stay put, so that customizing doesn't get in the way of play.
22. As a DM, I want the Stat Block drawer from Global Search not to open beside the Dashboard when Stat Blocks is already a panel there, so that the entry isn't shown twice.

## Implementation Decisions

- **Library:** react-grid-layout 2.3.0, pinned exactly. It provides snapping, collision push and vertical compaction, drag handles and resize handles, and works offline as a bundled dependency (no runtime fetch). Its stylesheet is bundled, restyled with the app's tokens.
- **Grid:** 120 columns and 8 px rows, so one step is about 8 px; no grid margin (the visual gap is padding inside each item). The grid width follows the Dashboard area (width-aware wrapper). No compaction (panels never float up); overlap not allowed, so a dropped panel pushes the ones it lands on down. During a drag or resize the other panels are laid out from where they were when it began (pushed down only as far as they are still in the way), so a pushed panel returns once uncovered (DM decision 2026-11-17: during the same drag only; no remembered home spot across drags).
- **Stored shape:** the Campaign's optional `dashboard` field is `{ grid: "fine", panels: [{ panelId, x, y, w, h }] }` in fine grid units. A missing field still means the default. A plain list is an older shape: revision 2 entries (12 columns, 40 px rows) are scaled (x and w by 10, y and h by 6), revision 1 entries are packed first and then scaled.
- **Default:** Session summary on the left half, tall; Player card and Pinned notes stacked on the right half. Exact row counts are tuned so the default looks like today's Dashboard.
- **Normaliser** (one function, used on read and on import): drops non-objects, missing, duplicate and (on read) unknown panel ids; rounds numbers; clamps x and w into the 12 columns; enforces the minimum size (w ≥ 30, h ≥ 24, about the old 3 by 4) and positive values; resolves overlaps by pushing the later panel down, without floating anything up. It also converts revision 1 entries (`width`/`height`, no `x`) by packing them in order the way revision 1 rendered them, with "normal" and "tall" mapped to fixed row counts.
- **Customize mode:** local Dashboard state, as before. While on, the title bar is the drag handle (cursor and a grip hint), the bottom-right corner resizes, and each panel shows "Remove <title>". Interactive content inside panels is excluded from starting a drag. While off, the grid is static.
- **Saving:** on drag stop and resize stop, never on every move. Same storage function and change-bus sync as revision 1.
- **Add panel:** appended at the bottom, 60 wide and 48 high (half width); the picker rules from revision 1 stay (excludes present panels and those marked not for the Dashboard).
- **Panel frames** get a fixed height from the grid; panel bodies scroll inside.
- **Removed from revision 1:** move up/down buttons, the width and height selects, and the order-based packing function (kept only inside the revision 1 migration).
- **Modes** keep rendering through the existing Mode layout component, unchanged.

## Testing Decisions

- Main seam stays the whole app on in-memory IndexedDB, driven like a user: customize toggle and Done (handles appear and disappear), add, remove, reset, empty state, persistence across re-render, per-Campaign isolation, export → import, duplicate, revision 1 migration, damaged layouts repaired. Assert on what the DM sees (regions present) and the saved grid positions.
- jsdom can't do real pointer drags or layout, so drag-to-move, resize, collision push and compaction get one Playwright test against the dev site (prior art: the existing e2e specs). That's a second seam, only for what the first can't reach.
- The normaliser (clamping, overlap repair, migration) is pure; test it directly where the app seam would need contrived stored data.
- Revision 1 tests about move buttons and width/height selects are replaced.

## Out of Scope

- Customizing Modes or Prep workspaces.
- A keyboard path for moving and resizing (the DM chose drag only; Remove, Add and Reset stay keyboard-reachable).
- Overlapping panels.
- Separate layouts per window size, phones or narrow windows.
- The same panel twice; named layout presets.

## Further Notes

- New runtime dependency (react-grid-layout); it gets precached by the offline service worker like the rest of the build.
- The working tree still has unrelated uncommitted work (Pop-out removal, Player card, Quick Add). Never run bare `tsc -b` in this repo: it writes .js copies that Vite picks up before the .ts sources.
