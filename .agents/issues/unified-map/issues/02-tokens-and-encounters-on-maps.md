# 02: Tokens and Encounters on Maps

Spec: docs/specs/0007-unified-map.md (stories 42-47, 51-56). ADR 0002.

**What to build:** Combat runs on the Map panel. Any Map can hold Tokens that snap to squares, even with the grid hidden. Tokens move by dragging or the arrow keys, can be free or linked to a Combatant (name, defeat mark, removal in "remove" defeat mode), and show the speed ring when selected, as today. The ruler measures in the Map's unit. An Encounter has a `mapId`. Starting one offers a Map picker, and with no pick a blank 20×20, 5 ft Map named after the Encounter is created. New Combatants get Tokens lined up on the sides as today. In Combat with an Encounter running, the panel shows that Encounter's Map. Tokens stay on the Map when the Encounter ends: linked Tokens whose Combatant is gone become free Tokens with their last name. A saved encounter stores `mapId` plus the token positions with link keys. Loading it restores those Tokens, or uses a blank Map if the saved Map was deleted. The Battle Map panel, the battleMaps storage module and the store itself (a DB bump) are removed, as is the saved-encounter `map` copy. Import ignores `battleMaps` and the saved-encounter `map`. Saved Dashboards naming `battle-map` remap to `map`.

**Blocked by:** 01

**Status:** done (2026-11-23)

- [x] Start an Encounter with a picked Map: Tokens appear on that Map. With no pick, a blank Map named after the Encounter exists and is used.
- [x] Token drag (Playwright) and arrow keys move by squares. The ruler shows feet or miles per the Map's unit. The speed ring still works.
- [x] Ending an Encounter keeps its Tokens on the Map as free Tokens.
- [x] Saving and then loading an encounter restores its Map and token positions. A deleted Map falls back to a blank one.
- [x] The upgrade removes `battleMaps`, and old exports with `battleMaps` import without error.
- [x] The BattleMap* tests and e2e/battle-map.spec.ts are rewritten against the Map panel. tsc is clean and the full suite passes.
