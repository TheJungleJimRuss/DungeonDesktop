# 09: Pop-out Window

**What to build:** The DM can send any panel (Party, NPC list or card, location view, Session scenes) to a second browser window for a second monitor. The window stays live-synced with the main window; closing it returns the panel to the main window. Popped-out panels are remembered per Campaign. It is DM-only; there is no player view.

**Blocked by:** 04 Party sheet, 06 NPC cards

**Status:** ready-for-agent

- [ ] A control on every panel sends it to the Pop-out Window
- [ ] Edits in either window appear in the other without reload
- [ ] Closing the Pop-out Window brings its panels back to the main window
- [ ] Popped-out panels are restored when the Campaign is reopened
- [ ] Playwright end-to-end tests cover the sync (the only real-browser tests)
