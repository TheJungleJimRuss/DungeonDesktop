# 02: Pin an NPC card to the Pop-out Window

**What to build:** From the NPC card (any Mode), the DM pins that NPC to the Pop-out Window. The pinned NPC shows in its own panel (e.g. "pinned-npc") that stays on that NPC while the main window's NPC selection changes, and live-syncs edits (including secrets revealed). Unpin from either window. The pin is per Campaign and survives a reload. Covers story 62.

**Blocked by:** 01

**Status:** done

- [x] "Pin to Pop-out" on the NPC card opens/uses the Pop-out Window with a pinned NPC panel
- [x] Pinned card does not follow the main window's NPC selection
- [x] Edits and revealed secrets sync to the pinned card
- [x] Unpin from either window; pin survives reload
- [x] Whole-App test; Playwright e2e for the cross-window sync (extend e2e/ pop-out tests)
