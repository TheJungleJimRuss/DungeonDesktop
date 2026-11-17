# 01: Scaffold and Campaign picker

**What to build:** A runnable local-first web app where the DM can create, rename, duplicate and delete isolated Campaigns from a Campaign picker, and data survives a reload. Includes the project scaffold and the test seam: the whole app rendered against an in-memory IndexedDB and driven like a user.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] App starts and shows a Campaign picker on launch
- [x] Create, rename and duplicate a Campaign
- [x] Delete requires explicit confirmation
- [x] Campaigns are isolated from each other
- [x] Data persists across reload (verified in a test by remounting the app)
- [x] Opening a Campaign shows an empty Dashboard placeholder
- [x] Test harness runs with one command and works offline
