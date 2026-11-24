# Glossary

**Campaign**: One ongoing game with its own party, NPCs, locations, notes and sessions. Campaigns are fully isolated from each other.

**Session**: A single play meeting within a Campaign, with its own prep notes and log.

**Mode**: A screen layout tuned to one situation in play (Combat, Exploration/Travel, Social/Roleplay, Prep). The DM switches Modes as the game moves between situations.

**Dashboard**: The main screen of a Campaign and the buttons that switch Mode. Its panels are the DM's choice, per Campaign: any panel, dragged and resized freely on a grid while customizing. By default it shows the session summary, player card and pinned notes.
_Avoid_: "cards" for the Dashboard's panels (a card is one entry's display, such as the NPC card).

**Party**: The player characters in a Campaign.

**Map**: A named drawing surface in a Campaign (a world, a city, a dungeon floor); a Campaign has any number. Each Map has a scale (one square = N feet or N miles), a grid that can be shown or hidden, and an optional background image. Lines, Shapes, Areas, Markers and Tokens all live on a Map.
_Avoid_: World Map, Battle Map (both are now just Maps).

**Line**: Straight segments joined point to point and left open. Each segment can be a wall, a door or plain.

**Shape**: A Line closed back on its first point. Its segments can be walls or doors like a Line's.

**Wall**: A Line or Shape segment drawn as a barrier. It is only drawn, never enforced on Tokens or sight.

**Door**: A Line or Shape segment drawn as a gap with a door mark.

**Area**: A Shape given a kind (free text such as City or Forest), a color and an optional name, and optionally linked to a Location.

**Marker**: A point on a Map with a name, color, icon and short note, optionally linked to a Location. Unlike a Token, it is placed freely, not on squares.
_Avoid_: pin, node.

**Route**: A Line drawn with the Route tool. It shows its length in the Map's unit.
_Avoid_: edge.

**Location**: A place record that NPCs and Scenes link to. It has no position of its own; it appears on Maps through linked Areas and Markers, possibly on several Maps.

**Token**: A named, coloured piece on a Map, placed on a grid square. The DM moves it by dragging (it snaps to squares) or with the arrow keys. It is free or linked to a Combatant. Tokens stay on the Map after the Encounter ends.

**Party Token**: An optional Token (at most one per Map) standing for the whole party. Dropping it inside an Area, or on a Marker, that is linked to a Location sets the party's location.

**Stat Block**: The rules entry describing a creature's abilities, as used in Combat.

**SRD**: The freely licensed core rules content (System Reference Document 5.2.1, Creative Commons BY 4.0) bundled with the site as reference data. Its attribution notice is shown in the app. Only SRD content is bundled.

**Global Search**: The shortcut-opened (Ctrl or Cmd + K) search over SRD entries (monsters, spells, magic items, equipment, conditions), fuzzy by name, grouped and filterable by type. Opening a result shows it in the Stat Blocks panel (a creature as a Stat Block, the other types as their own cards).

**Encounter**: One fight being tracked in Combat mode, played on one Map (a blank one is made if the DM picks none); a saved encounter remembers its Map and where its Tokens stood. A Campaign has at most one in-progress Encounter; it survives a reload and ends when the DM ends it.

**Combatant**: One participant in an Encounter: a Party member, a monster (SRD or custom, copies auto-numbered "Goblin 1", "Goblin 2"), or an ad-hoc entry with just a name, initiative and HP.

**Initiative Order**: The Combatants of an Encounter sorted by initiative, highest first. Ties keep their order until the DM breaks them manually. The DM steps through it turn by turn; one full pass is a round.

**Condition**: A standard 5e 2024 status effect (Blinded, Prone, Stunned, ...) applied to a Combatant, optionally for a number of rounds. A timed Condition counts down at the end (default) or start of its Combatant's turn and warns the DM when it ends; its rules text comes from the SRD.

**Scratch Note**: A quick note jotted during a conversation in Social mode, optionally attached to an NPC and/or a scene (default: the NPC selected on the card). Shown on that NPC's card and on the scene in Prep. Separate from Pinned notes.
