# 0006 Subclasses on the character sheet

Status: draft, awaiting approval (2026-11-23)

## Goal
A character with an SRD class can pick a subclass. The subclass's features, up to the current level, are added to the
character's normal Features list like every other auto item (see `mergeAutoLists`): editable, removable, swapped out
when the subclass changes, and topped up on level-up (including XP awards).

## Decisions (from the user, 2026-11-23)
- Offer all 48 2024 subclasses: the 12 SRD 5.2.1 ones with full feature text (already in `subclasses.json` /
  `class-features.json`), plus the other 36 from the 2024 Player's Handbook as **names and feature names with levels
  only**, no rulebook text. Same pattern as the non-SRD backgrounds: hand-written file
  `src/data/extra/subclasses-phb2024.json`, `source: "PHB 2024"`, merged in `loadCharacterData`.
- Picking a subclass auto-adds its features.

## Behaviour
- **Subclass** dropdown sits next to Class, shown once an SRD class is picked. Options: that class's subclasses
  (SRD first, then PHB, alphabetical within each), plus "—". Disabled hint below level 3 ("Subclass from level 3");
  the choice can still be made early, and features only appear from their level.
- Saved as `subclassId` + `subclass` (name, so cards need no SRD load). Changing class clears it.
- Features: SRD subclass features come from `Subclass.features` (level-tagged). PHB ones from the extra file's
  `features: { name, level }[]`. Both feed `computeAuto`'s feature list, so `mergeAutoLists` handles add/remove.
- The class's own "Subclass" placeholder feature (e.g. `fighter-subclass`, "Fighter Subclass") is dropped from the
  auto list once a subclass is picked.
- Cards (Character Sheet, Player card, Combat card) show "Fighter 5 (Champion)".
- Reference search/cards: PHB subclasses appear as Subclass cards with feature names and levels, marked
  "(PHB 2024, not in SRD 5.2.1)", no description text.

## Data shape (extra file)
`{ id, name, class: { id, name }, source: "PHB 2024", summary: "", description: "", features: [{ id: "", name, level }] }`
fitting the existing `Subclass` interface (`source?` added, like `Background`).

## Tests
- autoSheet: Champion at 3 adds Improved Critical; at 7 adds Remarkable Athlete + Additional Fighting Style;
  switching subclass swaps untouched features, keeps edited ones; class change clears subclass.
- Data: 48 subclasses, 4 per class, unique ids, every PHB feature has a name and level 3–20.
- Form: dropdown appears after picking a class, lists only that class's subclasses, features land in the editable list.

## Out of scope
Subclass spell lists (domain/oath spells), subclass-granted proficiencies, resource trackers, multiclassing.
