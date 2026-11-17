# 01: Social layout, filters and secrets

**What to build:** Social/Roleplay mode puts the right NPCs in front of the DM. The NPC list in Social mode defaults to NPCs at the Party's current location (Campaign.partyLocationId, matched by Npc.locationId) and can be filtered by faction (Npc.factionTag) and location; the NPC card shows motivation and every secret with its revealed state at a glance, and a secret can be marked revealed (or un-revealed) right there. No new data model. Covers stories 61, 63, 64, 69.

**Blocked by:** none

**Status:** done

- [x] Social mode NPC list shows NPCs at the Party's location by default, with a clear way to show all
- [x] Faction and location filters on the list (combinable; empty state when nothing matches)
- [x] NPC card in Social shows motivation and secrets, each visibly revealed or hidden
- [x] Toggle a secret's revealed state from the Social view; the change shows in Prep and the Pop-out Window
- [x] Whole-App test against in-memory IndexedDB (src/Social.test.tsx)
