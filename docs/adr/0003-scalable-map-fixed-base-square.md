# 0003: Scalable Map uses an endless canvas with a fixed 5 ft base square; old Maps are deleted

Status: proposed (2026-11-25, spec 0009)

## Context

Spec 0009 makes one Map zoom smoothly from a continent down to a battle square. Today each Map has a fixed size (at most 200 × 200 squares), its own scale ("1 square = N ft or mi") and one background image. Under a single scalable Map:

- A per-Map scale no longer means anything. Tokens and the ruler need a battle square, and the grid already relabels itself with zoom.
- A fixed size can't hold a continent at battle detail.
- One background image can't stay sharp across a zoom range of about 10,000,000,000×.

## Decision

- A Map is endless. Its coordinates are base squares of exactly 5 ft, unbounded in every direction. The Map record drops `unit`, `perSquare`, `width`, `height` and `background`.
- Old Maps are not converted. DB version 9 deletes every Map and the Map links on Encounters and saved Encounters. Locations, NPCs, Scenes, the Party and Encounter Combatants all stay. Importing an old export skips old-shape Maps.
- Background images are removed for now.

## Alternatives considered

- **Keep a per-Map scale.** Rejected by the owner: Tokens on a mile-scale Map would be a mile wide, and one Map couldn't hold both a world and a battle.
- **Rescale old content so its distances stay true.** Offered and declined by the owner in favour of starting fresh.
- **Keep old squares as 5 ft each.** Rejected: every old world Map would shrink to battle size and its Route lengths would be wrong.
- **Several placed images instead of none.** Deferred by the owner. They may return in a later spec.

## Consequences

- The DM loses drawings and Tokens on existing Maps. The app warns once and offers Export first, but nothing re-imports the old Maps.
- Any later per-Map scale or image feature must fit the fixed 5 ft base and the endless canvas.
