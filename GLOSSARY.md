# Glossary

**Campaign**: One ongoing game with its own party, NPCs, locations, notes and sessions. Campaigns are fully isolated from each other.

**Session**: A single play meeting within a Campaign, with its own prep notes and log.

**Mode**: A screen layout tuned to one situation in play (Combat, Exploration/Travel, Social/Roleplay, Prep). The DM switches Modes as the game moves between situations.

**Dashboard**: The main screen of a Campaign and the buttons that switch Mode. Its panels are the DM's choice, per Campaign: any panel, dragged and resized freely on a grid while customizing. By default it shows the session summary, player card and pinned notes.
_Avoid_: "cards" for the Dashboard's panels (a card is one entry's display, such as the NPC card).

**Party**: The player characters in a Campaign.

**Map**: A named, endless drawing surface in a Campaign that zooms smoothly from a continent down to a single battle square, so one Map can hold a world, its cities and their dungeons. A Campaign may still have several (another plane, say). Its base square is always 5 ft; the shown grid relabels itself with zoom (1 square = 50 ft, 10 mi, ...) and can be hidden. Lines, Shapes, Areas, Markers and Tokens all live on a Map; things too small to see at the current zoom fade out.
_Avoid_: World Map, Battle Map (both are just Maps); scale map, region map.

**Line**: Straight segments joined point to point and left open. Each segment can be a wall, a door or plain.

**Shape**: A Line closed back on its first point. Its segments can be walls or doors like a Line's.

**Wall**: A Line or Shape segment drawn as a barrier. It is only drawn, never enforced on Tokens or sight.

**Door**: A Line or Shape segment drawn as a gap with a door mark.

**Area**: A Shape given a kind (free text such as City or Forest), a color and an optional name, and optionally linked to a Location. It can have Holes. Unmaking an Area drops its Holes.

**Subtract shape**: Cutting the inside of another Shape or Area (the cutter, which stays on the Map) out of an Area. A cut fully inside makes a Hole; a cut across the edge makes a Notch. A cut that would split the Area in two, remove all of it, or leave a Hole or the outline touching an edge at a single point is refused.
_Avoid_: erase, boolean

**Hole**: A part cut out of an Area, fully inside its outline: no fill there, and a click there is not on the Area. A Hole has no walls or doors; its points can be dragged and it can be removed.

**Notch**: A bite out of an Area's outline, made by a cut or Hole that crosses the edge. It rewrites the outline (the new segments are plain), so the DM confirms it first.

**Marker**: A point on a Map with a name, color, icon and short note, optionally linked to a Location. Unlike a Token, it is placed freely, not on squares. It remembers the zoom it was placed at and fades out once the view zooms out past its Priority.
_Avoid_: pin, node.

**Priority**: How far out a Marker stays visible, counted from the zoom it was placed at: Minor (3x, a chest), Normal (10x, a room or building), Major (100x, a town) or Always (never fades, a capital). An Area has its own Priority for its label: Normal (the label hides once the Area is narrower on screen than its name), Major (the label stays while the Area is drawn) or Always (a dot and the label stay at every zoom).

**Route**: An open Line turned into a Route with Make route (Unmake route turns it back), the way a Shape becomes an Area. It shows its length from the 5 ft base square, in ft below 1,000 ft and in mi from there.
_Avoid_: edge.

**Location**: A place record that NPCs and Scenes link to. It has no position of its own; it appears on Maps through linked Areas and Markers, possibly on several Maps.

**Token**: A named, coloured piece on a Map, placed on a grid square. The DM moves it by dragging (it snaps to squares) or with the arrow keys. It is free or linked to a Combatant. Tokens stay on the Map after the Encounter ends.

**Party Token**: An optional Token (at most one per Map) standing for the whole party. Unlike other Tokens it never fades when zoomed out. Dropping it inside an Area, or on a Marker, that is linked to a Location sets the party's location.

**Stat Block**: The rules entry describing a creature's abilities, as used in Combat.

**Custom Entry**: A monster, spell or magic item the DM adds to one Campaign, shaped like its SRD counterpart and found by Global Search alongside the SRD. Used for content from the DM's own books.
_Avoid_: homebrew (a Custom Entry may be official content), custom monster (spells and items count too)

**Paste stat block**: Filling a Custom Entry's form from text the DM copies out of a 2024-layout book or D&D Beyond, reviewed before saving. Lines it cannot place are shown, never dropped silently.
_Avoid_: import (that is a Campaign JSON file)

**SRD**: The freely licensed core rules content (System Reference Document 5.2.1, Creative Commons BY 4.0) bundled with the site as reference data. Its attribution notice is shown in the app. Only SRD content is bundled.

**Global Search**: The shortcut-opened (Ctrl or Cmd + K) search over SRD entries (monsters, spells, magic items, equipment, conditions), fuzzy by name, grouped and filterable by type. Opening a result shows it in the Stat Blocks panel (a creature as a Stat Block, the other types as their own cards).

**Encounter**: One fight being tracked in Combat mode, played on one Map (a blank one is made if the DM picks none) at the spot in view when it starts; a saved encounter remembers its Map, its spot and where its Tokens stood. A Campaign has at most one in-progress Encounter; it survives a reload and ends when the DM ends it.

**Combatant**: One participant in an Encounter: a Party member, a monster (SRD or custom, copies auto-numbered "Goblin 1", "Goblin 2"), or an ad-hoc entry with just a name, initiative and HP.

**Initiative Order**: The Combatants of an Encounter sorted by initiative, highest first. Ties keep their order until the DM breaks them manually. The DM steps through it turn by turn; one full pass is a round.

**Condition**: A standard 5e 2024 status effect (Blinded, Prone, Stunned, ...) applied to a Combatant, optionally for a number of rounds. A timed Condition counts down at the end (default) or start of its Combatant's turn and warns the DM when it ends; its rules text comes from the SRD.

**Scratch Note**: A quick note jotted during a conversation in Social mode, optionally attached to an NPC and/or a scene (default: the NPC selected on the card). Shown on that NPC's card and on the scene in Prep. Separate from Pinned notes.
