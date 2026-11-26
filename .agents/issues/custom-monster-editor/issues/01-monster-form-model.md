# 01: Monster form model (pure)

Spec: docs/specs/0010-custom-monster-editor.md ("Storage: unchanged", "Code shape").

**What to build:** `src/srd/monsterForm.ts`, a pure module that turns stored `MonsterData` (SRD Monster shape minus id/name) into structured editor state and back, plus the CR tables and attack text. No UI.

**Blocked by:** None

**Status:** done (2026-11-25)

- [x] `MonsterForm` type: basics, cr/xp/pb, ac/acNote/hp/hpRoll, speed {walk,burrow,climb,fly,swim: number|null, hover, other}, abilities, saves {ability, bonus|null(=auto)}[], skills {key, level: "proficient"|"expertise", bonus|null}[], senses {blindsight,darkvision,tremorsense,truesight: number|null, other}, languages string[] + telepathy number|null, defenses (vulnerabilities/resistances/immunities: string[] each incl. Other rows; conditionImmunities string[]), entry sections as {name,desc}[], legendaryUses.
- [x] `toMonsterForm(data)` / `fromMonsterForm(form)`; untouched fields (gear, xpInLair, lairActions...) pass through. Auto bonus kept as null when stored bonus equals mod+PB (or mod+2PB); otherwise kept as override. Passive Perception computed on save.
- [x] `CR_OPTIONS`, `CR_XP`, `crToPb`, `abilityMod`, `signed`, `attackText(spec)`.
- [x] Tests incl. SRD round-trip over src/data/srd/monsters.json.
