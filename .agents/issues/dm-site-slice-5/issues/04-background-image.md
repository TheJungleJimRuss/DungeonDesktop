# 04: Background image

**What to build:** The DM can set, replace or clear an image behind a Battle Map grid, with a simple scale/offset so squares line up. The image is stored as a Blob in IndexedDB with the map and included in Campaign export/import (encoded in the JSON, e.g. a data URL) and in saved encounters. Works offline. Covers story 79.

**Blocked by:** 01

**Status:** done

- [x] Set/replace/clear background image from a file picker
- [x] Scale and offset controls; grid drawn over the image
- [x] Stored as Blob; round-trips through export/import and saved encounters
- [x] Whole-App test
