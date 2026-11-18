# 05: Offline and licence close-out

**What to build:** The new character-data chunk works offline, and the licence record lists the added upstream files. Spec: docs/specs/0004-srd-search-expansion.md (stories 11, 12).

**Blocked by:** 03 (Species), 04 (Classes).

**Status:** done

- [x] The offline Playwright spec opens a class card with the network off
- [x] ADR 0001 lists every added upstream file with its hash, under the same SRD 5.2.1 CC BY 4.0 basis; the attribution footer text is unchanged
- [x] Full Vitest, `npx tsc --noEmit`, `npm run build` and e2e all pass
