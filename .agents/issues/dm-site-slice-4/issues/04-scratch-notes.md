# 04: Scratch notes for conversations

**What to build:** A Scratch Notes panel in Social mode for quick notes during a conversation. Notes reuse the `notes` collection with a new kind ("scratch"), so they are already in export/import and sync across windows. Each note can be attached to an NPC and/or a scene (sessionId + sceneId from src/storage/sessions.ts); notes default to attaching to the NPC selected on the card. Attached notes show on that NPC's card and on the scene in Prep. Covers stories 67, 68.

**Blocked by:** 01

**Status:** done

- [x] Scratch Notes panel: add, edit, delete; newest first
- [x] Attach a note to an NPC and/or a scene; defaults to the selected NPC
- [x] Attached notes visible on the NPC card and the scene in Prep
- [x] Pinned notes are unaffected (kind filter); scratch notes round-trip through export/import
- [x] Whole-App test
