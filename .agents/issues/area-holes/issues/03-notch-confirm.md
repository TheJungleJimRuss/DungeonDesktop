# 03: Notch with preview and confirm

**What to build:** A Subtract shape cut that crosses the Area's edge previews the notched outline and asks "Cut notch?" inline (Yes / No). Yes saves the new outline (absorbing any Hole the cut touched); surviving outline edges keep their wall/door/plain kind, new edges are plain. No leaves the Area unchanged. Esc acts as No.

**Blocked by:** 02

**Status:** done

- [x] Unit tests: segment kinds kept on edges lying along old edges, plain on new ones
- [x] jsdom app tests: preview shown, Yes saves, No/Esc leave the Area unchanged, walls on surviving edges kept
