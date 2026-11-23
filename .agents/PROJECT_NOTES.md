# Project notes

## Status
2026-11-23: Spec 0005 Auto character sheet built (docs/specs/0005-auto-character-sheet.md, tickets .agents/issues/auto-character-sheet/issues/ 01-05 done): Player card in Combat (replaces the dice column), attack to-hit = ability + prof + magic, SRD class/species/background dropdowns with Custom, auto fields with per-field manual override and "Reset to auto", level from XP with Award XP (Player card + end-encounter step). Plus a speed ring around the selected Battle Map token (src/battle/speed.ts, useCombatantSpeed.ts). 358 Vitest; full suite has 1-2 load flakes (CombatPlayerCard, CharacterSheets "SRD packs") that pass alone. Browser-checked. Not committed. Older status lines are in NOTES_ARCHIVE.md.

## Current goal
Specs 0002-0005 done. Commit the uncommitted work, then settle open questions (see Next steps) and pick the next spec.

## Active decisions
- Local-first React + Vite + TypeScript static app; IndexedDB; per-Campaign JSON export/import. No server, no accounts.
- 5e 2024 only; bundled SRD 5.2.1 (CC BY 4.0), monsters first. Source: 5e-bits/5e-database 2024 monsters pinned by commit and SHA-256; rebuild with `npm run build:srd` (scripts/build-srd.mjs) into src/data/srd/*.json, lazy-imported (own chunk), no runtime third-party fetch. Exact attribution wording: ADR 0001 and src/srd/attribution.ts (footer shown in the app).
- DM-only. No player view. Pop-out Window removed 2026-11-17 (with Pinned NPC); data still syncs across tabs via the change bus.
- No in-world calendar or clock. World Map = nodes and distances; Battle Map = grid with named, colored tokens and a measuring tool.
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
- Link NPC to SRD Stat Block (story 23) waits for slice 2.

- Battle Map: the map needs an in-progress Encounter (keyed by encounterId); the panel shows a hint otherwise. Grid size inputs commit on blur/Enter (committing per keystroke remounts the input and drops focus). In a letterboxed SVG (max-height) compute pointer squares from the CTM, not the element box (e2e does the box maths itself).

- Escape from a field inside a guarded editor form still runs the Dashboard shortcut (shortcuts.ts `escapeFromEditor`), because those forms autofocus their first field.
- Unsaved guard: editor forms opt in with `<form {...GUARD}>` (src/ui/unsaved.ts); `<main>` marks them dirty via capture events; every mode switch/All campaigns goes through `confirmLeave()` (window.confirm). Quick add forms are deliberately unguarded.
- Combat: party members at 0 HP are Dying (death saves on Combatant.deathSaves), not Defeated; only 3 failures = dead. Damage at 0 HP adds a failure, healing clears saves. advanceTurn/rewindTurn skip isDefeated combatants unless all are. End encounter is a two-step inline confirm ("Yes, end it").

- Auto sheet: auto values are written into the PartyMember record on save (computeAuto/applyAuto in src/party/autoSheet.ts, applyAutoAndSave/awardXp in src/party/recompute.ts); `manual` marks hand-edited fields. Readers keep reading plain fields. Legacy records keep their numbers as manual.
- Attacks: Proficient adds PB to to-hit only, not damage (briefly added to damage 2026-11-23, reverted same day at the user's request). Damage = dice + ability mod + magic + Extra damage box. Attack editor (CharacterForm AttackFields) is shared by the New attack fieldset and each attack's Edit toggle; edit-mode inputs carry "<Field> of <name>" aria-labels.
- Ending an Encounter with Party combatants opens the "Award XP to party" dialog (src/panels/AwardXpStep.tsx); tests click "End without XP" after "Yes, end it".
- Player card in Combat duplicates Damage/Heal buttons: scope tracker queries with within(region).

## Next steps
- Spec 0005 limits: background skills re-added on save even if un-ticked; XP from monsters already removed ("Remove defeated") isn't counted; speed ring ignores fly/swim, used movement and speed-0 conditions.
- Remaining playtest UX findings 11-14 (low) from the 2026-11-17 mock session: create-and-open campaign, CR shown as 0.25 vs 1/4, scene checkbox label, missing mode tools (Name Generator, Social dice, add location from World Map, "Edge" jargon).
- Open questions: Battle Map only exists during an Encounter; ruler has no keyboard path; Social location filter replaces party scoping rather than narrowing.
- Background image is stored as {type, ArrayBuffer} on the map record, not a Blob (fake-indexeddb can't clone jsdom Blobs).
