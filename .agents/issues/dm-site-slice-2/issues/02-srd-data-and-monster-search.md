# 02: SRD data and monster search

**What to build:** SRD 5.2 monsters are bundled with the app as static data, and a global search (opened by a shortcut) finds them. Opening a result shows the monster's Stat Block as a panel in a clear, familiar layout (abilities, traits, actions, legendary and lair actions where present). The required Creative Commons attribution is shown in the app. This ticket also settles where the SRD 5.2 source data comes from and how it is converted; record that decision (including licence and attribution wording) in an ADR or the project notes, and keep the conversion script in the repo so the data can be rebuilt.

**Blocked by:** 01 Shortcut layer

**Status:** done (2026-11-16). Decision: docs/adr/0001-srd-data-source.md. Open: confirm the licence reading noted in the ADR.

- [x] Source of the SRD 5.2 data chosen, licence verified, decision recorded
- [x] Monster data bundled as static files and loaded lazily; the app still builds offline-capable (no runtime fetch to third parties)
- [x] A shortcut opens global search; typing finds monsters by name
- [x] Opening a result shows a Stat Block panel with all standard sections
- [x] The Stat Block is a registered panel so it can be placed in a Mode and popped out
- [x] Attribution visible in the app
- [x] A check confirms the bundled monster data parses and every entry is searchable; tests use a small fixture dataset
