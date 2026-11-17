# 05: Offline use

**What to build:** Once loaded, the built site works with no internet: the app and all SRD data are cached by a service worker. When a new version is available the DM sees a prompt and chooses when to update, so a reload never surprises them mid-session.

**Blocked by:** 02 SRD data and monster search

**Status:** done

- [x] Service worker precaches the app shell and bundled SRD data
- [x] With the network off, a previously loaded site opens, and Campaigns, search and Stat Blocks work (real-browser Playwright test)
- [x] When a new version is available a visible prompt offers to update; nothing reloads until the DM accepts
- [x] The development server and the unit tests are unaffected by the service worker
- [x] Documented how to test offline behavior and how updates ship
