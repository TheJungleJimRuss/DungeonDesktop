# Project notes

## Status
2026-11-23: Spec 0007 Unified Map built (docs/specs/0007-unified-map.md, ADR 0002, tickets .agents/issues/unified-map/issues/ 01-07 done): World Map and Battle Map replaced by named Maps (src/storage/maps.ts, src/panels/MapPanel.tsx, src/map/) with Lines/Shapes/walls/doors, Areas, Markers, Routes, Tokens and an optional Party Token; DB v8 deletes old map data. Code-reviewed, browser-checked. Not committed. Older status lines are in NOTES_ARCHIVE.md.

## Current goal
Specs 0002-0005 done. Commit the uncommitted work, then settle open questions (see Next steps) and pick the next spec.

## Active decisions
- Local-first React + Vite + TypeScript static app; IndexedDB; per-Campaign JSON export/import. No server, no accounts.
- 5e 2024 only; bundled SRD 5.2.1 (CC BY 4.0), monsters first. Source: 5e-bits/5e-database 2024 monsters pinned by commit and SHA-256; rebuild with `npm run build:srd` (scripts/build-srd.mjs) into src/data/srd/*.json, lazy-imported (own chunk), no runtime third-party fetch. Exact attribution wording: ADR 0001 and src/srd/attribution.ts (footer shown in the app).
- DM-only. No player view. Pop-out Window removed 2026-11-17 (with Pinned NPC); data still syncs across tabs via the change bus.
- No in-world calendar or clock. Maps (spec 0007): a Campaign has many named Maps, each with its own unit, scale and optional grid; an Encounter plays on one Map (blank one made if none picked). Walls are visual only. Route length comes from the Map scale. The shown grid keeps its on-screen size at every zoom and its "1 square = N" label scales with zoom (user request 2026-11-23); Tokens, drawing snap, ruler and Routes still use the Map's own squares.
- One test seam: whole app on in-memory IndexedDB, driven like a user; Playwright only for what jsdom can't do (pointer drag, offline). Vitest runs files sequentially (fileParallelism false) because assertions flaked under load.
- Vocabulary in GLOSSARY.md. Spec and tickets are local files (.agents/issues/dm-site/issues/).

## Gotchas
- Panel loading/empty text: use `<Loading />` and `<EmptyState goTo="party">` from src/ui/PanelStates.tsx, not bare `<p className="muted">`.
- Never run bare `tsc -b`: tsconfig has no noEmit, so it writes a .js beside every .ts/.tsx, and Vite resolves .js first (stale code in tests). Use `npx tsc --noEmit`.
- Panels list themselves with listPanels(); `notOnDashboard: true` in registerPanel hides one from the Dashboard picker (used for social-npc-list).
- New panel: registerPanel in src/panels/registry.ts, place it in src/modes/modes.ts, import it in ui/ModeLayout.tsx.
- New collection: writes sync across windows automatically (getDb proxy); readers subscribe via useChangeVersion in src/sync/changeBus.ts.
- All shortcuts go through src/shortcuts/shortcuts.ts: registerShortcut({combo,label,handler}) throws on a taken combo; useShortcut(combo,label,fn) in components; mount useShortcutListener once per window (Dashboard). Modes are Alt+1-5 (matched by physical key), Esc = Dashboard; when not typing, the bare key also fires its Alt shortcut (1 = Alt+1, D = Alt+D). Ignored while typing or when a [role=dialog] is in the DOM, so new dialogs must use role="dialog". Registries are per window; a key press only reaches the focused window.
- Dashboard always lands first, with a "Continue in <Mode>" button (not auto-resume).
- Offline: dist/sw.js is generated at build by scripts/sw-plugin.mjs (precaches all built files incl. SRD chunk; prod-only registration in src/offline/updates.ts; update prompt waits for the DM). See docs/offline.md. Offline e2e uses vite preview on port 5198.
- SRD: Monster shape is src/srd/monsters.ts (custom entries should reuse it); loadMonsters() is lazy and cached; tests swap in src/srd/fixtures.ts with setMonsterSource(). Add spells/items/conditions as more files from the same upstream folder with the same hash-pinned script. Upstream README claims OGL for the 2024 data (stale); our basis is SRD 5.2.1 CC BY 4.0 (open licence-confirmation item in the ADR). SRD 5.2.1 has no lair-action lists; legendary uses are fixed at 3 by the converter.
- Global Search: Ctrl+K and Meta+K (main window only, ignored while typing in a field). A result sets the per-Campaign selection (src/srd/selection.ts, synced across tabs); Modes without a Stat Blocks panel show it in a side drawer. Search is a dialog (role="dialog"), so other shortcuts pause while open.
- SRD character data (feats, backgrounds, rules, species, classes) is a second lazy chunk: loadCharacterData() in src/srd/character.ts; tests use setCharacterSource() with the fixture. Ids are unique per type only, never mix types. Global Search groups are in fixed type order; the initial highlight goes to the first exact name match.
- Backgrounds: the 12 non-SRD 2024 PHB backgrounds are hand-written mechanics only (no prose) in src/data/extra/backgrounds-phb2024.json (not touched by build:srd), merged and name-sorted in loadCharacterData, tagged `source: "PHB 2024"`. Their feat id is "" when the feat isn't in SRD 5.2.1 (Crafter, Musician, Tough, Healer, Lucky, Tavern Brawler), so the card shows the name without a link.
- Link NPC to SRD Stat Block (story 23) waits for slice 2.

- Map: one mode-aware panel (src/panels/MapPanel.tsx) with drawing, Area, Marker and Route code in src/map/ (pure geometry in geometry.ts, tested alone). Lines are one record type: `closed` = Shape, per-segment plain/wall/door, `route`, `area`. Panel-specific keys claim Esc/Enter/Delete with useShortcutClaim(combo, active, handler) in shortcuts.ts. Grid size inputs commit on blur/Enter (committing per keystroke remounts the input and drops focus). In a letterboxed SVG (max-height) compute pointer squares from the CTM, not the element box (e2e does the box maths itself).

- Escape from a field inside a guarded editor form still runs the Dashboard shortcut (shortcuts.ts `escapeFromEditor`), because those forms autofocus their first field.
- Unsaved guard: editor forms opt in with `<form {...GUARD}>` (src/ui/unsaved.ts); `<main>` marks them dirty via capture events; every mode switch/All campaigns goes through `confirmLeave()` (window.confirm). Quick add forms are deliberately unguarded.
- Combat: party members at 0 HP are Dying (death saves on Combatant.deathSaves), not Defeated; only 3 failures = dead. Damage at 0 HP adds a failure, healing clears saves. advanceTurn/rewindTurn skip isDefeated combatants unless all are. End encounter is a two-step inline confirm ("Yes, end it").

- Auto sheet: auto values are written into the PartyMember record on save (computeAuto/applyAuto in src/party/autoSheet.ts, applyAutoAndSave/awardXp in src/party/recompute.ts); `manual` marks hand-edited fields. Readers keep reading plain fields. Legacy records keep their numbers as manual.
- Auto list items (class/species/background features, proficiencies, background skills, option-A kit and gold) go into the ordinary features/proficiencies/skills/equipment/coins, fully editable (user request 2026-11-23). mergeAutoLists tracks `autoAdded`: idempotent, never re-adds what the DM removed or edited, swaps out untouched entries when class/species/background/level change. The form runs it in an effect keyed on those ids + level. Legacy autoFeatures/autoProficiencies fold in via migrateAutoLists (listParty and applyAuto).
- Species type (subspecies: Draconic Ancestor, Elven Lineage, …): a second dropdown, shown only when the SRD species has types, labelled with the shared name prefix. Saved as subspeciesId + subspecies (name, so cards need no SRD load; speciesLabel() shows "Dragonborn (Red)"). Its traits join autoFeatures; changing species clears it.
- Subclasses: 12 SRD + 36 PHB 2024 (names and feature name/level only, hand-written src/data/extra/subclasses-phb2024.json, `source: "PHB 2024"`), merged and sorted (SRD first) in loadCharacterData. PartyMember.subclassId + subclass (name); classLabel() gives "Fighter (Champion)". computeAuto adds the subclass's features up to level (only if its class matches) and drops class-feature ids ending "-subclass"; mergeAutoLists does the rest. Changing class clears the subclass.
- Attacks: Proficient adds PB to to-hit only, not damage (briefly added to damage 2026-11-23, reverted same day at the user's request). Damage = dice + ability mod + magic + Extra damage box. Attack editor (CharacterForm AttackFields) is shared by the New attack fieldset and each attack's Edit toggle; edit-mode inputs carry "<Field> of <name>" aria-labels.
- Attack search (2026-11-23): src/panels/AttackSearch.tsx, presets from src/party/attackPresets.ts (SRD weapons parse `damage`; spells take the first "NdM <Type> damage" in the text). Used in the form's New attack (fills the draft) and the sheet view's Attacks card (adds directly). Spells set `abilityDamage: false` (checkbox "Ability to damage"), so the spell mod goes to hit only.
- Ending an Encounter with Party combatants opens the "Award XP to party" dialog (src/panels/AwardXpStep.tsx); tests click "End without XP" after "Yes, end it".
- Player card in Combat duplicates Damage/Heal buttons: scope tracker queries with within(region).
- Damage types (spec 0008): HpControls has a "Damage type <name>" select; adjustDamage (src/combat/damageTypes.ts) runs before applyDamage (immune skips it, so no death-save failure). Defenses come from the monster stat block or PartyMember damageResistances/Immunities/Vulnerabilities (Character form "Defenses"). The Player card's own HP box has no type select.
- Encounter difficulty (spec 0008): src/combat/difficulty.ts (2024 XP budget, hand-typed) + EncounterDifficulty.tsx in the Initiative tracker; party combatants, else whole Party. Fixture "Test Ghoul" is CR 3 monstrosity so CR/type filter tests stay unchanged.

## Next steps
- Spec 0007 open questions: no way to clear the party location now the Locations select is gone (Party Token only sets it); deleting a Location renames a linked Marker to the Location's name while Areas keep their own; Map delete is blocked for the Encounter's Map in the UI only.
- Spec 0005 limits: XP from monsters already removed ("Remove defeated") isn't counted; speed ring ignores fly/swim, used movement and speed-0 conditions.
- Spec 0008 combat rules pass (R1 damage types, R2 difficulty) built 2026-11-23, tickets .agents/issues/combat-rules-pass/ done, browser-checked, not committed.
- 2026-11-23 mock playthrough: docs/playtests/2026-11-23-mock-playthrough.md (bugs B1-B6, rules gaps R1-R8, UX U1-U11, suggested order). B1 = working tree doesn't build mid unified-map ticket 02.
- Remaining playtest UX findings 11-14 (low) from the 2026-11-17 mock session: create-and-open campaign, CR shown as 0.25 vs 1/4, scene checkbox label, missing mode tools (Name Generator, Social dice, add location from World Map, "Edge" jargon).
- Open questions: ruler has no keyboard path; Social location filter replaces party scoping rather than narrowing.
- Background image is stored as {type, ArrayBuffer} on the map record, not a Blob (fake-indexeddb can't clone jsdom Blobs).
