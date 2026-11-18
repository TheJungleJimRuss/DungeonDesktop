# 03: Species, subspecies and traits

**What to build:** The DM can search Species, Subspecies and Traits, all under a Species chip. A species card shows creature type, size and speed, its traits (collapsible, collapsed by default) and its subspecies as links. A subspecies card links to its species and shows any damage type and its traits. A trait card shows the species it belongs to (as links) and its description. Spec: docs/specs/0004-srd-search-expansion.md.

**Blocked by:** 02 (Feats, Backgrounds and Rules in search).

**Status:** done

- [x] The build writes species JSON (species, subspecies, traits) from the hash-pinned upstream files
- [x] Results labelled e.g. "Species · Medium", "Dragonborn subspecies", "Dragonborn trait"
- [x] Every parent/child link resolves (data test) and opens the linked card (app test)
- [x] App test: open a Species from a Mode without Stat Blocks and it shows in the drawer
