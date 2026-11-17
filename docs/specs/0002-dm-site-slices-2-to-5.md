Status: draft, awaiting "Approved" (local file; no tracker configured)

Continues docs/specs/0001-dm-site.md. Slice 1 (shell, Dashboard, Campaigns with export/import, Party, Prep, Pop-out Window) is built. This spec covers the remaining slices, in this order: 2 Combat with SRD data and global search, 3 World Map with travel, 4 Social/Roleplay, 5 Battle Map. Slice 2 also closes two open items from slice 1: offline use of the built site, and linking an NPC to a Stat Block.

## Problem Statement

The DM can now prepare a Campaign, but the moments that matter most at the table are still empty: running a fight, tracking travel between places, roleplaying with NPCs, and positioning creatures on a grid. Reference lookups (monsters, spells, conditions) still send the DM to books and other sites, and the site still can't be relied on with no internet.

## Solution

Fill in the remaining Modes so each one shows exactly what the DM needs for that situation. Bundle SRD 5.2 reference data so monsters, spells, items and conditions are searchable offline. Combat mode tracks initiative, HP, conditions, concentration and legendary/lair actions beside the active creature's Stat Block. Exploration/Travel mode shows a World Map of places and computes travel days. Social mode puts the right NPCs in front of the DM for the current location. A Battle Map grid with named, coloured tokens and a measuring tool is linked to the Combat tracker. Everything stays DM-only, local-first, and usable in a Pop-out Window.

## User Stories

Slice 2: SRD data, global search, offline
1. As a DM, I want SRD 5.2 monsters, spells, magic items, equipment and conditions bundled with the site, so that I never need a book or internet for rules reference.
2. As a DM, I want the site to work fully offline once loaded, so that a bad connection at the table doesn't stop the game.
3. As a DM, I want the site to tell me when a new version is available and let me choose when to update, so that a reload mid-session never surprises me.
4. As a DM, I want a keyboard shortcut that opens a global search, so that I can look something up in seconds.
5. As a DM, I want search results grouped by type (monster, spell, item, condition), so that I can find the right entry fast.
6. As a DM, I want search to tolerate typos and partial words, so that I can find things while rushed.
7. As a DM, I want to filter search by type, and for monsters by challenge rating and creature type, so that I can narrow down quickly.
8. As a DM, I want to open a result as a panel, so that I can read it without leaving my Mode.
9. As a DM, I want to send a result to the Pop-out Window, so that it stays visible on my second monitor.
10. As a DM, I want monster Stat Blocks displayed in a clear, familiar layout, so that I can read abilities, actions and traits at a glance.
11. As a DM, I want spell entries to show level, school, casting time, range, components, duration and description, so that I can rule on them immediately.
12. As a DM, I want to create custom entries (homebrew monsters, spells, items), so that my own content sits beside the SRD.
13. As a DM, I want custom entries to be part of the Campaign's export and import, so that they travel with it.
14. As a DM, I want custom entries to be marked as custom in search, so that I never confuse them with official rules.
15. As a DM, I want to duplicate an SRD entry into a custom one and edit it, so that I can reskin monsters quickly.
16. As a DM, I want the required SRD attribution shown in the app, so that the content licence is respected.
17. As a DM, I want to link an NPC to a Stat Block (SRD or custom), so that its combat numbers are one click away.
18. As a DM, I want an NPC card to show its linked Stat Block, so that I don't have to search for it.
19. As a DM, I want global shortcuts not to fire while I am typing in a field, so that notes are never disrupted.

Slice 2: Combat mode
20. As a DM, I want to start an encounter and add Party members and monsters to it, so that I can run a fight.
21. As a DM, I want to add monsters from SRD and custom entries by search, so that I don't type stat blocks.
22. As a DM, I want multiple copies of one monster auto-numbered (Goblin 1, Goblin 2), so that I can tell them apart.
23. As a DM, I want to add an ad-hoc combatant with just a name, initiative and HP, so that I can improvise.
24. As a DM, I want to roll initiative for all monsters at once and type in the players' results, so that I handle digital and physical dice.
25. As a DM, I want the initiative order sorted automatically with a manual tie-break, so that the order is always right.
26. As a DM, I want to advance and rewind turns, so that I can follow the fight and fix mistakes.
27. As a DM, I want the current round and the active combatant clearly highlighted, so that I never lose track.
28. As a DM, I want to track HP per combatant with quick damage and healing entry, so that tracking is fast.
29. As a DM, I want temporary HP tracked separately and absorbed first, so that the numbers are correct.
30. As a DM, I want combatants shown as bloodied at half HP and clearly marked at 0 HP, so that I notice at a glance.
31. As a DM, I want to apply standard conditions with optional durations, so that I remember when they end.
32. As a DM, I want durations to count down at the right moment in the round and warn when a condition ends, so that none lingers by mistake.
33. As a DM, I want to see a condition's rules text on hover or click, so that I don't have to look it up.
34. As a DM, I want to mark a combatant as concentrating and be reminded to call for a save when they take damage, so that I don't forget.
35. As a DM, I want legendary actions shown with their remaining uses, so that I use them across the round.
36. As a DM, I want lair actions flagged at initiative count 20, so that they happen on time.
37. As a DM, I want the active combatant's Stat Block shown beside the tracker, so that I can act without searching.
38. As a DM, I want the Stat Block of any combatant one click away, so that I can check anyone mid-fight.
39. As a DM, I want a built-in dice roller that accepts expressions like 2d6+3 with advantage and disadvantage, so that I can roll without leaving the app.
40. As a DM, I want to click an attack or damage entry in a Stat Block to roll it, so that rolling is one action.
41. As a DM, I want a roll history, so that I can review what was rolled.
42. As a DM, I want to remove defeated combatants or keep them greyed out, so that I choose what clutters the screen.
43. As a DM, I want to end combat and have the Party's remaining HP written back to the Party sheet, so that the next scene starts with the right numbers.
44. As a DM, I want an in-progress encounter to survive a reload, so that a crash never loses a fight.
45. As a DM, I want to save an encounter composition and reuse it, so that I can prepare fights in advance.
46. As a DM, I want the tracker, Stat Block and dice roller as separate panels, so that I can spread them across both monitors.

Slice 3: World Map and travel
47. As a DM, I want a World Map of places as nodes joined by edges with distances in miles, so that I can track geography.
48. As a DM, I want to create and edit edges between existing locations, so that I can connect my places.
49. As a DM, I want to drag nodes into position on the map, so that it resembles my world.
50. As a DM, I want to set terrain on each edge, so that travel reflects difficulty.
51. As a DM, I want to set where the Party currently is, so that everyone knows where we are.
52. As a DM, I want the app to compute travel days for slow, normal and fast pace over an edge, so that I can answer how long a trip takes instantly.
53. As a DM, I want to choose a route across several nodes and see total distance and days, so that I can plan journeys.
54. As a DM, I want the app to suggest the shortest route between two places, so that I don't plan by hand.
55. As a DM, I want to move the Party along a route and have its location update, so that the map stays current.
56. As a DM, I want to open a location's notes and linked NPCs from the map, so that I see details in context.
57. As a DM, I want to see passive Perception of the Party in Exploration mode, so that I can rule on noticing things.
58. As a DM, I want a travel pace reminder (what each pace allows or costs), so that I can rule on the consequences.
59. As a DM, I want the World Map and route panels separate, so that I can pop the map out to a second monitor.
60. As a DM, I want edges and positions included in Campaign export and import, so that the map travels with the Campaign.

Slice 4: Social/Roleplay mode
61. As a DM, I want a Social layout showing NPCs at the Party's current location with motivations and secrets, so that I can roleplay confidently.
62. As a DM, I want to pin an NPC card to the Pop-out Window, so that it stays visible through a conversation.
63. As a DM, I want an NPC's secrets and whether each was revealed visible at a glance, so that I know what the players already learned.
64. As a DM, I want to mark a secret as revealed from the Social view, so that I don't switch to Prep.
65. As a DM, I want a quick NPC name generator, so that I can invent people on the fly.
66. As a DM, I want to create a quick NPC from a generated name with one click, so that improvised characters are saved.
67. As a DM, I want a scratch-notes panel for the current conversation, so that I record what players learn.
68. As a DM, I want to attach scratch notes to the current scene or an NPC, so that they aren't lost.
69. As a DM, I want faction and location filters on the NPC list in Social mode, so that I can find relevant people.

Slice 5: Battle Map
70. As a DM, I want a grid Battle Map with adjustable size, so that it fits any encounter.
71. As a DM, I want tokens with names and colours, so that I can tell combatants apart.
72. As a DM, I want to drag tokens across the grid, so that I can show movement.
73. As a DM, I want a measuring tool that reports the distance in feet between two points, so that I can rule on range and movement.
74. As a DM, I want the measuring tool to snap to grid squares and use a configurable feet-per-square, so that measurements match the encounter.
75. As a DM, I want tokens linked to Combat tracker combatants, so that names and colours stay consistent.
76. As a DM, I want selecting a token to highlight its combatant in the tracker, and the reverse, so that I move between map and numbers quickly.
77. As a DM, I want a defeated combatant's token to be visibly marked, so that the map stays accurate.
78. As a DM, I want to add extra tokens not linked to combatants (objects, markers), so that I can show scenery.
79. As a DM, I want an optional background image behind the grid, so that I can lay it over a map.
80. As a DM, I want Battle Maps to be saved per encounter and included in export and import, so that I can reuse them.
81. As a DM, I want the Battle Map as its own panel, so that I can pop it out to a second monitor.

## Implementation Decisions

- Builds on the slice-1 architecture: panel registry, Mode layouts, per-Campaign IndexedDB collections, cross-window change bus, Pop-out Window. New features are new panels and collections; they do not change those foundations. Any new collection syncs across windows through the existing write hook.
- Vocabulary follows GLOSSARY.md. New terms to add when slice 2 starts: Encounter, Combatant, Condition, Initiative Order, Custom Entry, Route, Token.
- SRD data: SRD 5.2 content (Creative Commons licence) converted at build time into static JSON files bundled with the app, split by type and loaded lazily; the data source and conversion script are a slice-2 ticket decision, and the licence attribution is shown in the app and kept with the data. Search is a client-side index over names and key fields with fuzzy matching.
- Custom entries are stored per Campaign in a collection of their own and merged into the search index; they are marked custom and use the same Stat Block shape as SRD entries so that Combat treats both identically.
- Offline: a service worker precaches the built app and SRD data; a visible "update available" prompt lets the DM apply an update on demand. Offline behaviour is verified in a real browser.
- Combat: an Encounter is persisted per Campaign while in progress. A Combatant is either a Party member (HP syncs to and from the Party sheet) or a monster/ad-hoc entry with its own HP. The tracker records initiative, round, active turn, HP, temp HP, conditions with durations, concentration, and legendary/lair state. The DM makes rulings; the app never resolves attacks or saves. Dice rolling is a small parser for standard expressions with advantage and disadvantage.
- The 5e 2024 condition list and their rules text come from the SRD data.
- World Map: edges are a separate per-Campaign collection (from, to, miles, terrain); location records gain a map position. The Party's current location is stored on the Campaign. Travel days follow the 2024 travel pace rules applied to distance and terrain; shortest route is a standard shortest-path search over edges. There is still no in-world clock or calendar.
- Social mode is composed from existing panels (NPC list, NPC card, locations) plus new scratch-notes and name-generator panels; there is no new data model beyond notes attached to a scene or NPC (reusing the notes collection with a kind field).
- Battle Map: a per-Encounter grid (size, feet per square, optional background image stored as a Blob in IndexedDB) with tokens (name, colour, grid position, optional link to a Combatant). Measuring is a ruler tool producing distance in feet with grid snapping. No fog, lighting or player-facing view.
- Global shortcut handling must be centralized so Mode switching, search and panel hotkeys do not collide; slice 2 moves the bare 1-4 Mode keys behind a modifier or a command layer once panels take keyboard input.
- Each slice is shippable and demoable on its own, in the order listed.

## Testing Decisions

- Same philosophy as spec 0001: tests drive the app as the DM does and assert on visible behavior; never on internal state or component structure.
- One seam: the whole app rendered against in-memory IndexedDB. Rules logic (initiative order, damage with temp HP, condition durations, dice expressions, travel days, shortest route, grid measuring) is tested through the visible results in this seam, not through separate unit seams.
- Real-browser Playwright tests only where jsdom cannot do the job: Pop-out sync of new panels, offline loading via the service worker, and Battle Map pointer dragging and measuring.
- Search and SRD tests use a small fixture dataset, not the full SRD, to keep tests fast; a separate check confirms the bundled SRD data parses and every entry is searchable.
- Prior art: the slice-1 tests under src (whole-App tests per feature) and the Pop-out e2e tests.

## Out of Scope

- Player-facing screens or views for players' own devices.
- Accounts, cloud sync, real-time collaboration, hosting.
- In-world calendar, clock, weather and light tracking.
- Automated attack, save and damage resolution.
- Fog of war, dynamic lighting, line of sight, virtual-tabletop features.
- Encounter builder with XP difficulty and budgets (later).
- 2014 ruleset, non-SRD copyrighted content, and importing from other tools.
- Mobile and tablet layouts.

## Further Notes

- Slice 2 is the largest and should be cut into several tickets: SRD data and search, offline, custom entries, Stat Block display, dice roller, tracker core, conditions and concentration, legendary/lair, Party HP write-back, NPC Stat Block links.
- Open items to decide at ticket time: where the SRD 5.2 source data comes from and how it is converted; whether the Dashboard should auto-resume the last Mode; the modifier key for Mode shortcuts.
- No issue tracker is configured; run /setup-matt-pocock-skills if you want one before to-tickets.
