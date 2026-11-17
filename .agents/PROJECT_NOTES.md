# Project notes

## Status
2026-11-17: Spec 0002 fully built (slices 2-5). Slice 4 Social (tickets in .agents/issues/dm-site-slice-4) and slice 5 Battle Map (.agents/issues/dm-site-slice-5) done. 224 Vitest, 12 Playwright, build clean. First commit 3ddee86 on main. Per-ticket history in NOTES_ARCHIVE.md.
2026-11-17: Follow-ups done: per-token "Link to combatant" select, background images downscaled to 2048 px (src/storage/imageResize.ts, injectable resizer; jsdom falls back to the original), several pinned NPCs (JSON id list per Campaign, old single id still read). 232 Vitest, 13 Playwright, build clean. Not committed.

## Current goal
Spec 0002 done. Settle open design questions from slices 4-5 (see Next steps), then decide the next spec.

## Active decisions
- Local-first React + Vite + TypeScript static app; IndexedDB; per-Campaign JSON export/import. No server, no accounts.
- 5e 2024 only; bundled SRD 5.2.1 (CC BY 4.0), monsters first. Source: 5e-bits/5e-database 2024 monsters pinned by commit and SHA-256; rebuild with `npm run build:srd` (scripts/build-srd.mjs) into src/data/srd/*.json, lazy-imported (own chunk), no runtime third-party fetch. Exact attribution wording: ADR 0001 and src/srd/attribution.ts (footer shown in the app).
- DM-only. No player view. Second monitor = Pop-out Window with any panel, live-synced.
- No in-world calendar or clock. World Map = nodes and distances; Battle Map = grid with named, colored tokens and a measuring tool.
- One test seam: whole app on in-memory IndexedDB, driven like a user; Playwright only for Pop-out sync. Vitest runs files sequentially (fileParallelism false) because assertions flaked under load.
- Vocabulary in GLOSSARY.md. Spec and tickets are local files (.agents/issues/dm-site/issues/).

## Gotchas
- New panel: registerPanel in src/panels/registry.ts, place it in src/modes/modes.ts, import it in ui/ModeLayout.tsx.
- New collection: writes sync across windows automatically (getDb proxy); readers subscribe via useChangeVersion in src/sync/changeBus.ts.
- All shortcuts go through src/shortcuts/shortcuts.ts: registerShortcut({combo,label,handler}) throws on a taken combo; useShortcut(combo,label,fn) in components; mount useShortcutListener once per window (Dashboard, PopoutApp). Modes are Alt+1-4 (matched by physical key), Esc = Dashboard. Ignored while typing or when a [role=dialog] is in the DOM, so new dialogs must use role="dialog". Registries are per window; a key press only reaches the focused window.
- Dashboard always lands first, with a "Continue in <Mode>" button (not auto-resume).
- Offline: dist/sw.js is generated at build by scripts/sw-plugin.mjs (precaches all built files incl. SRD chunk; prod-only registration in src/offline/updates.ts; update prompt waits for the DM). See docs/offline.md. Offline e2e uses vite preview on port 5198.
- SRD: Monster shape is src/srd/monsters.ts (custom entries should reuse it); loadMonsters() is lazy and cached; tests swap in src/srd/fixtures.ts with setMonsterSource(). Add spells/items/conditions as more files from the same upstream folder with the same hash-pinned script. Upstream README claims OGL for the 2024 data (stale); our basis is SRD 5.2.1 CC BY 4.0 (open licence-confirmation item in the ADR). SRD 5.2.1 has no lair-action lists; legendary uses are fixed at 3 by the converter.
- Global Search: Ctrl+K and Meta+K (main window only, ignored while typing in a field). A result sets the per-Campaign selection (src/srd/selection.ts, synced to the Pop-out Window); Modes without a Stat Blocks panel show it in a side drawer. Search is a dialog (role="dialog"), so other shortcuts pause while open.
- Link NPC to SRD Stat Block (story 23) waits for slice 2.

- Battle Map: the map needs an in-progress Encounter (keyed by encounterId); the panel shows a hint otherwise. Grid size inputs commit on blur/Enter (committing per keystroke remounts the input and drops focus). In a letterboxed SVG (max-height) compute pointer squares from the CTM, not the element box (e2e does the box maths itself).

## Next steps
- Open questions: Battle Map only exists during an Encounter; ruler has no keyboard path; Social location filter replaces party scoping rather than narrowing.
- Background image is stored as {type, ArrayBuffer} on the map record, not a Blob (fake-indexeddb can't clone jsdom Blobs).
