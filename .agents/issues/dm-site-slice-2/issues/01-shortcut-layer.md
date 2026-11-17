# 01: Shortcut layer

**What to build:** One central place that handles every keyboard shortcut, so Mode switching, global search and panel hotkeys never collide. Mode switching moves from bare 1 to 4 keys to Alt + 1 to 4 (Esc still returns to the Dashboard). No shortcut fires while the DM is typing in a field. Later tickets register their shortcuts here (global search uses it first).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Alt + 1 to 4 switches Mode; bare 1 to 4 no longer does
- [x] Esc returns to the Dashboard, and does not fire while typing or while a dialog is open
- [x] No shortcut fires while typing in an input, textarea, select or editable field
- [x] Shortcuts work in the Pop-out Window where relevant and never fire twice across windows
- [x] Panels can register their own shortcut through the central layer, and a conflicting registration is rejected visibly in tests
- [x] The Mode buttons show the new shortcut hints
- [x] Existing Mode tests updated to the new keys and passing
