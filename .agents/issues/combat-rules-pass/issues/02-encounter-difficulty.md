# 02: Encounter difficulty in the Initiative tracker

Spec: docs/specs/0008-combat-rules-pass.md (Slice 2). Playtest finding R2.

**What to build:** A pure `src/combat/difficulty.ts` with the 2024 per-character XP budget table (levels 1–20, clamped) and `encounterDifficulty(levels, monsterXp)` → `{ total, budget, band }` (Below Low / Low / Moderate / High / Above High, no multiplier). The Initiative tracker shows "Moderate · 300 XP" plus a muted "Low 150 · Moderate 225 · High 400 for 1 character (level 3)" line, using party combatants in the Encounter, or the whole Party "(whole party)" when none are added. Monster XP from the stat block (SRD or custom); ad-hoc and XP-less count 0 with "N without XP not counted". Defeated monsters still count. Hidden with no monsters or no party at all.

**Blocked by:** None (can start immediately)

**Status:** done (2026-11-23)

- [x] `XP_BUDGET` table and `encounterDifficulty` with unit tests: each band boundary, level clamping, mixed levels, zero XP.
- [x] Difficulty line in `InitiativeTrackerPanel` updating as monsters are added/removed.
- [x] Falls back to the whole Party when no party combatants are in the Encounter.
- [x] App tests for the line and the fallback. `npx tsc --noEmit` clean.
