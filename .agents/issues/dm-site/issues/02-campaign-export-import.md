# 02: Campaign export and import

**What to build:** The DM can export a Campaign to a versioned JSON file and import it back, to back up or move machines.

**Blocked by:** 01 Scaffold and Campaign picker

**Status:** done

- [x] Export downloads one JSON file containing the whole Campaign
- [x] Import creates a Campaign from a valid file
- [x] Importing a Campaign that already exists warns before overwriting
- [x] Invalid or wrong-version files are rejected with a clear message
- [x] Round trip (export then import) reproduces the Campaign, verified in a test
