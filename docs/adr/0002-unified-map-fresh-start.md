# 0002: Unified Map starts fresh; old World Map and Battle Map data is deleted

Status: accepted (2026-11-23, spec 0007)

## Context

Spec 0007 replaces the World Map (Locations as nodes with x/y, plus Edges with typed miles and terrain) and the per-Encounter Battle Map with one kind of thing: a campaign can hold many named Maps that share one toolset. The old data doesn't map cleanly onto the new model:

- Old World Map positions sit on an 800×500 canvas with no real scale.
- Edge miles were typed by hand, while Route length now comes from the Map's scale.
- Battle Maps were keyed by Encounter, while a Map now stands alone and an Encounter picks one.

## Decision

Start fresh. One IndexedDB version bump:

- deletes the `battleMaps` and `edges` stores;
- strips `x`/`y` from every Location;
- drops the `map` copy from saved encounters.

Locations themselves stay, along with NPC and Scene links and the party location.

Campaign export/import no longer reads or writes `battleMaps` or `edges`. Importing an old export ignores those collections (and a saved encounter's `map`) instead of failing.

## Alternatives considered

- **Convert everything.** Places become Markers, Edges become Routes, and each Battle Map becomes a Map named after its Encounter. Rejected by the owner: the old positions and miles mean nothing under a real scale.
- **Leave the old data unused.** Rejected: dead stores linger and confuse later readers and migrations.

## Consequences

- The DM loses old map layouts, edge distances and battle tokens. They can export a campaign first to keep a copy, but nothing re-imports it as Maps.
- The `src/travel` pace and travel-day logic has no reader left and is removed with the World Map panel.
