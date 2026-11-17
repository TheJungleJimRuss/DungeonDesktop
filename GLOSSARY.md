# Glossary

**Campaign**: One ongoing game with its own party, NPCs, locations, notes and sessions. Campaigns are fully isolated from each other.

**Session**: A single play meeting within a Campaign, with its own prep notes and log.

**Mode**: A screen layout tuned to one situation in play (Combat, Exploration/Travel, Social/Roleplay, Prep). The DM switches Modes as the game moves between situations.

**Dashboard**: The main screen of a Campaign and the buttons that switch Mode. Its panels are the DM's choice, per Campaign: any panel, dragged and resized freely on a grid while customizing. By default it shows the session summary, player card and pinned notes.
_Avoid_: "cards" for the Dashboard's panels (a card is one entry's display, such as the NPC card).

**Party**: The player characters in a Campaign.

**World Map**: A map of nodes (places such as cities) joined by edges with distances, used to track travel between locations.

**Battle Map**: A simple grid used to track positions during a fight. There is one per Encounter (adjustable width x height in squares, and feet per square, default 5); a saved encounter keeps a copy of it and loading one restores it.

**Token**: A named, coloured marker on the Battle Map, placed on a grid square. The DM moves it by dragging (snaps to squares) or with the arrow keys; it is free or linked to a Combatant, chosen per token in the token list (a linked token shows the Combatant's name, is marked when defeated and goes when the Combatant does).

**Stat Block**: The rules entry describing a creature's abilities, as used in Combat.

**SRD**: The freely licensed core rules content (System Reference Document 5.2.1, Creative Commons BY 4.0) bundled with the site as reference data. Its attribution notice is shown in the app. Only SRD content is bundled.

**Global Search**: The shortcut-opened (Ctrl or Cmd + K) search over SRD entries (monsters, spells, magic items, equipment, conditions), fuzzy by name, grouped and filterable by type. Opening a result shows it in the Stat Blocks panel (a creature as a Stat Block, the other types as their own cards).

**Encounter**: One fight being tracked in Combat mode. A Campaign has at most one in-progress Encounter; it survives a reload and ends when the DM ends it.

**Combatant**: One participant in an Encounter: a Party member, a monster (SRD or custom, copies auto-numbered "Goblin 1", "Goblin 2"), or an ad-hoc entry with just a name, initiative and HP.

**Initiative Order**: The Combatants of an Encounter sorted by initiative, highest first. Ties keep their order until the DM breaks them manually. The DM steps through it turn by turn; one full pass is a round.

**Condition**: A standard 5e 2024 status effect (Blinded, Prone, Stunned, ...) applied to a Combatant, optionally for a number of rounds. A timed Condition counts down at the end (default) or start of its Combatant's turn and warns the DM when it ends; its rules text comes from the SRD.

**Scratch Note**: A quick note jotted during a conversation in Social mode, optionally attached to an NPC and/or a scene (default: the NPC selected on the card). Shown on that NPC's card and on the scene in Prep. Separate from Pinned notes.
