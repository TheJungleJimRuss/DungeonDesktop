Status: draft, awaiting "Approved" (not yet published to a tracker; none is configured)

## Problem Statement

As a Dungeon Master running 5e 2024 games, I juggle notes, stat blocks, maps, rules lookups and party stats across books, tabs and paper. Each moment of play (a fight, travel, a conversation, prep) needs different information in front of me, and I lose time and flow hunting for it. I want one site that shows exactly what I need for the situation I'm in, and lets me spread more information across a second monitor.

## Solution

A local-first web app, laptop/desktop first, with no accounts or server. I pick a Campaign, land on a Dashboard, and switch between Modes (Combat, Exploration/Travel, Social/Roleplay, Prep). Each Mode is a layout of panels tuned to that situation. Any panel can be sent to a Pop-out Window on a second monitor, kept live in sync. A global search looks up SRD 5.2 monsters, spells, items and conditions. A World Map tracks places and travel distances, and a Battle Map grid tracks fights. All data is saved in the browser and can be exported and imported per Campaign as a JSON file.

## User Stories

Campaigns and data
1. As a DM, I want to create multiple Campaigns, so that my different games never mix.
2. As a DM, I want a Campaign picker on launch, so that I can jump into the right game.
3. As a DM, I want to rename, duplicate and delete a Campaign, so that I can manage my games.
4. As a DM, I want deleting a Campaign to require confirmation, so that I never lose a game by accident.
5. As a DM, I want everything to autosave, so that a closed tab never loses my work.
6. As a DM, I want to export a Campaign to a JSON file, so that I can back it up or move machines.
7. As a DM, I want to import a Campaign from a JSON file, so that I can restore it.
8. As a DM, I want import to warn me before overwriting an existing Campaign, so that I don't lose newer data.
9. As a DM, I want the site to work offline, so that a bad connection at the table doesn't stop the game.

Dashboard and navigation
10. As a DM, I want a Dashboard as the main screen, so that I see the state of my Campaign at a glance.
11. As a DM, I want the Dashboard to show the current Session summary, so that I remember where we are.
12. As a DM, I want the Dashboard to show the Party at a glance (AC, HP, passive Perception), so that I can answer questions without looking things up.
13. As a DM, I want pinned notes on the Dashboard, so that critical reminders are always visible.
14. As a DM, I want one-click buttons to switch Mode, so that I can change layouts as the game changes.
15. As a DM, I want keyboard shortcuts to switch Mode, so that I don't reach for the mouse mid-scene.
16. As a DM, I want the app to remember my last Mode per Campaign, so that I return where I left off.

Party
17. As a DM, I want to add player characters with name, class, level, AC, max HP, passive Perception and notes, so that I have their key numbers handy.
18. As a DM, I want to edit and remove party members, so that the Party stays current as characters change.
19. As a DM, I want to level up characters by editing level, so that the Party reflects the story.

Prep mode: NPCs
20. As a DM, I want to create NPC cards with name, role, appearance, motivation, secrets and notes, so that I can portray them consistently.
21. As a DM, I want to tag NPCs with a location and faction, so that I can find who is where.
22. As a DM, I want to search and filter NPCs, so that I find one quickly.
23. As a DM, I want to link an NPC to an SRD Stat Block, so that I have combat numbers ready.
24. As a DM, I want to mark NPC secrets as revealed, so that I know what the players already learned.

Prep mode: locations
25. As a DM, I want to create locations as World Map nodes with notes, so that each place has information attached.
26. As a DM, I want to link NPCs and scenes to locations, so that I can see everything about a place in one view.

Prep mode: sessions and scenes
27. As a DM, I want to create a Session with a title and summary, so that each game night has its own plan.
28. As a DM, I want to add ordered scenes with a goal, notes, secrets and clues, so that I can outline the evening.
29. As a DM, I want to reorder scenes by dragging, so that I can reshape the plan as it changes.
30. As a DM, I want checkboxes on secrets and clues, so that I can tick them off during play.
31. As a DM, I want to mark a scene as played, so that I see what's left.
32. As a DM, I want to write a post-session log, so that I remember what happened next time.
33. As a DM, I want unused scenes and secrets to carry over to the next Session, so that nothing prepped is lost.

Pop-out window
34. As a DM, I want to send any panel to a Pop-out Window, so that I can use my second monitor for more information.
35. As a DM, I want the Pop-out Window to stay live-synced with the main window, so that edits show on both.
36. As a DM, I want to close the Pop-out Window and have the panel return to the main window, so that nothing is lost.
37. As a DM, I want the app to remember which panels were popped out, so that I can restore my layout.

Global search and rules
38. As a DM, I want a keyboard shortcut that opens search, so that I can look something up in seconds.
39. As a DM, I want search across SRD monsters, spells, items and conditions, so that one box answers everything.
40. As a DM, I want to open a result as a panel or send it to the Pop-out Window, so that it stays visible while I run the game.
41. As a DM, I want to create custom entries (homebrew monsters, items), so that my own content sits beside the SRD.

Combat mode
42. As a DM, I want to build an initiative order from the Party and monsters, so that I can run turns.
43. As a DM, I want to roll or type initiative, so that I handle both digital and physical dice.
44. As a DM, I want to advance and rewind turns and track the round, so that I can follow the fight.
45. As a DM, I want to track HP for each combatant, including temporary HP, so that damage and healing are accurate.
46. As a DM, I want to apply conditions with optional durations, so that I remember when they end.
47. As a DM, I want to track concentration, so that I'm reminded to call for saves.
48. As a DM, I want legendary and lair actions shown on the right turns, so that I use them.
49. As a DM, I want multiple copies of one monster auto-numbered, so that I can tell goblins apart.
50. As a DM, I want the active combatant's Stat Block shown beside the tracker, so that I can act without searching.
51. As a DM, I want a built-in dice roller, so that I can roll without leaving the app.
52. As a DM, I want to end combat and keep the Party's remaining HP, so that the next scene starts correctly.

World Map and travel
53. As a DM, I want a World Map of nodes and edges with distances in miles, so that I can track the geography.
54. As a DM, I want to set terrain on each edge, so that travel reflects difficulty.
55. As a DM, I want to set the Party's location, so that I know where they are.
56. As a DM, I want the app to compute travel days at slow, normal and fast pace, so that I can answer "how long will it take?" instantly.
57. As a DM, I want to pick a route across several nodes and see total distance and days, so that I can plan journeys.
58. As a DM, I want to open a location's notes from the map, so that I can see details in context.

Social/Roleplay mode
59. As a DM, I want a view of NPCs at the current location with motivations and secrets, so that I can roleplay confidently.
60. As a DM, I want to pin an NPC card to the Pop-out Window, so that I can keep it visible through a conversation.
61. As a DM, I want a quick name generator, so that I can invent NPCs on the fly.
62. As a DM, I want to jot quick notes during a conversation, so that I record what players learn.

Battle Map
63. As a DM, I want a grid Battle Map with adjustable size, so that it fits any encounter.
64. As a DM, I want tokens with names and colors, so that I can tell combatants apart.
65. As a DM, I want to drag tokens across the grid, so that I can show movement.
66. As a DM, I want a measuring tool that reports distance in feet between two points, so that I can rule on range and movement.
67. As a DM, I want tokens linked to Combat mode combatants, so that names and colors stay consistent.
68. As a DM, I want an optional background image, so that I can place the grid over a map.

## Implementation Decisions

- Single-page React + Vite + TypeScript app, built to static files; no backend.
- Persistence in IndexedDB, with each Campaign as an isolated data set. Export and import produce a versioned JSON document per Campaign; import validates schema and version.
- Domain vocabulary follows GLOSSARY.md: Campaign, Session, Mode, Dashboard, Party, Pop-out Window, World Map, Battle Map, Stat Block, SRD.
- Modes are layouts composed of reusable panels. A panel is a self-contained view that can render in the main window or the Pop-out Window.
- Pop-out Window uses a second browser window opened from the app and shares state with the main window through the browser's cross-window messaging, so both always show the same data. Popped-out panel state is remembered per Campaign.
- Reference content: SRD 5.2 data bundled as static JSON and loaded for offline use; indexed for global search. Custom entries are stored in the Campaign and appear in search beside SRD entries.
- Rules target 5e 2024 only.
- World Map is a graph: nodes (locations) and edges (distance in miles plus terrain). Travel days are computed from distance, terrain modifier and pace. There is no in-world clock or calendar.
- Battle Map is a grid with named, colored tokens and a measuring tool in feet (5 ft per square by default); no fog, lighting or player-facing view.
- Combat tracks initiative, rounds, HP, temp HP, conditions with durations, concentration, and legendary/lair actions. The DM makes rulings; the app does not resolve attacks or saves.
- Slice order: (1) shell, Dashboard, Campaign management, export/import, Party, Prep (NPCs, locations, Sessions and scenes); (2) Combat plus global search and SRD data; (3) World Map and travel; (4) Social; (5) Battle Map. Pop-out Window lands with the first slice that has panels worth sending (slice 1 ships the mechanism for Dashboard and Prep panels).
- Slice 1 includes only the location notes and graph editing needed for Prep; the travel calculation arrives in slice 3.

## Testing Decisions

- Good tests drive the app the way the DM does (click, type, keyboard shortcut) and assert on what is visible or exported; they never assert on internal state or component structure.
- One seam: the whole app rendered against an in-memory IndexedDB (fake-indexeddb), driven by user-level interactions. Persistence is verified by reloading the app within the test, and by exporting then importing a Campaign.
- Rule logic (initiative ordering, travel days, distance measuring) is tested through this same seam via visible results, not through separate unit seams.
- The Pop-out Window sync is the one exception: it needs a real browser, so it gets a small number of end-to-end tests in Playwright.
- No prior art exists; the project is empty.

## Out of Scope

- Player-facing screens or any view for players' own devices.
- Accounts, cloud sync, real-time collaboration, hosting.
- In-world calendar, clock, weather and light tracking.
- Automated attack, save and damage resolution.
- Fog of war, dynamic lighting, virtual-tabletop features.
- Encounter builder with XP difficulty (later).
- 2014 ruleset support.
- Mobile and tablet layouts.

## Further Notes

- No issue tracker is configured (no docs/agents/issue-tracker.md). This spec is saved locally; run /setup-matt-pocock-skills if you want it published to a tracker before to-tickets.
- Bundled SRD 5.2 content must carry the required Creative Commons attribution in the app.
