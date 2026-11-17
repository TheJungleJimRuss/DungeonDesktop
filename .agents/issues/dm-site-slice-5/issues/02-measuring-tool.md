# 02: Measuring tool

**What to build:** A ruler mode on the Battle Map: drag (or click start then end, or use the keyboard) between two squares and see the distance in feet. Snaps to square centres; uses the map's feet per square; distance follows the 2024 rule (each square moved, including diagonals, costs one square). Pure maths in src/battle/measure.ts. Covers stories 73, 74.

**Blocked by:** 01

**Status:** done

- [x] Ruler toggle; line and distance label shown while measuring
- [x] Snaps to squares; uses feet per square; diagonals count as one square
- [x] Unit tests for the maths; whole-App test via keyboard or clicks; Playwright e2e for pointer measuring
