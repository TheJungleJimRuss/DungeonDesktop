# 01: Search keyboard reaches every group, plus group caps

**What to build:** In Global Search, ↑/↓ move the highlight through every result in display order, Custom results included, and Enter opens the highlighted one (today Custom is only reachable when there are no SRD hits). Under the "All" chip each type group shows at most 8 results; with a type chip chosen it shows up to 20. Spec: docs/specs/0004-srd-search-expansion.md (stories 9, 10).

**Blocked by:** None (can start immediately).

**Status:** done

- [x] ↓ past the last SRD result highlights the first Custom result; Enter opens it in the Custom card
- [x] Mouse hover and keyboard share one highlight across all groups
- [x] "All" caps each group at 8; a chosen chip allows 20 (monster CR/type listing with an empty query keeps its current behaviour)
- [x] App tests drive both through the dialog; existing search tests still pass
