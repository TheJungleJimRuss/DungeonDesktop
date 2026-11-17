# 06: Dice roller

**What to build:** A dice roller panel. The DM types an expression like 2d6+3 (with advantage or disadvantage for d20 rolls), sees the result with the individual dice, and keeps a roll history. It is a registered panel so it can sit in Combat mode or in the Pop-out Window, and it exposes a way for other panels (Stat Block attacks, later) to roll an expression.

**Blocked by:** 01 Shortcut layer

**Status:** done

- [x] Expressions with multiple dice, modifiers and sums (e.g. 2d6+3, 1d20+5, 4d6 drop lowest not required)
- [x] Advantage and disadvantage on d20 rolls show both dice and the one kept
- [x] Invalid expressions show a clear message and do not roll
- [x] Roll history lists results with the expression, individual dice and total
- [x] A shortcut focuses the roller input
- [x] Rolls are testable deterministically (the random source can be controlled in tests)
- [x] Other panels can request a roll through a small shared interface
