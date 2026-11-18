# 04: Classes, subclasses and features

**What to build:** The DM can search Classes, Subclasses and Class features (subclass features included), all under a Classes chip. A class card shows hit die, primary ability, saving throws, proficiencies, skill choices, starting equipment and multiclass notes. It then shows the full level table (level, proficiency bonus, class-specific columns, cantrips and prepared spells, spell slots 1-9, with columns empty for that class hidden), every feature by level (collapsible), and its subclasses as links. A subclass card shows its parent class link, summary, description and features by level. A feature card shows its parent class or subclass link, its level and its description. Spec: docs/specs/0004-srd-search-expansion.md.

**Blocked by:** 02 (Feats, Backgrounds and Rules in search).

**Status:** done

- [x] The build writes classes JSON (classes with level rows and feature ids, subclasses, features) from the hash-pinned upstream files
- [x] The level table drops all-empty columns (a Barbarian has no spell slot columns; a Wizard has no Rages)
- [x] Results labelled e.g. "Class · d12", "Barbarian feature · level 1", "Champion (Fighter) · level 3"
- [x] Converter tests: class_specific and spellcasting columns, subclass features land under the subclass
- [x] App test: search "rage", open the Rage feature, follow the link to Barbarian, see a Rages column
