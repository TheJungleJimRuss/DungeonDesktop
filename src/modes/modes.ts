/** Where a panel sits in a Mode's grid (12 columns, rows auto-sized; 1-based lines). */
export interface PanelPlacement {
  panelId: string;
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
}

export type ModeId = "combat" | "exploration" | "social" | "prep" | "party";

/** A focused arrangement of a Mode's panels, picked from a tab bar. */
export interface Workspace {
  id: string;
  label: string;
  layout: PanelPlacement[];
}

export interface ModeDefinition {
  id: ModeId;
  label: string;
  /** Combo that switches to this Mode (see src/shortcuts). */
  shortcut: string;
  /** The default arrangement (and the first workspace, if the Mode has any). */
  layout: PanelPlacement[];
  /** Optional tab bar of focused arrangements; the first one equals `layout`. */
  workspaces?: Workspace[];
}

const p = (panelId: string, col: number, colSpan: number, row: number, rowSpan = 1): PanelPlacement => ({
  panelId, col, colSpan, row, rowSpan,
});

export const DASHBOARD_LAYOUT: PanelPlacement[] = [
  p("session-summary", 1, 6, 1, 2),
  p("party-glance", 7, 6, 1),
  p("pinned-notes", 7, 6, 2),
];

const PREP_ALL: PanelPlacement[] = [
  p("session-prep", 1, 3, 1), p("locations", 1, 3, 2), p("npc-list", 4, 3, 1, 2), p("npc-card", 7, 3, 1, 2),
  p("location-view", 10, 3, 1, 2), p("scenes", 1, 12, 3), p("custom-entries", 1, 12, 4),
];

export const MODES: ModeDefinition[] = [
  { id: "combat", label: "Combat", shortcut: "Alt+1",
    layout: [p("battle-map", 1, 8, 1, 2), p("initiative-tracker", 9, 4, 1), p("combatant-stat-block", 9, 4, 2), p("stat-blocks", 9, 4, 3), p("dice-roller", 9, 4, 4)] },
  { id: "exploration", label: "Exploration/Travel", shortcut: "Alt+2",
    layout: [p("world-map", 1, 8, 1, 2), p("travel-log", 9, 4, 1), p("party-glance", 9, 4, 2), p("passive-perception", 9, 4, 3), p("location-view", 1, 8, 3), p("route", 1, 12, 4)] },
  { id: "social", label: "Social/Roleplay", shortcut: "Alt+3",
    layout: [p("social-npc-list", 1, 4, 1, 2), p("npc-card", 5, 5, 1, 2), p("name-generator", 10, 3, 1), p("pinned-notes", 10, 3, 2), p("scratch-notes", 1, 12, 3)] },
  { id: "prep", label: "Prep", shortcut: "Alt+4", layout: PREP_ALL, workspaces: [
    { id: "all", label: "All panels", layout: PREP_ALL },
    { id: "scenes", label: "Scenes", layout: [p("session-prep", 1, 4, 1), p("scenes", 5, 8, 1)] },
    { id: "npcs", label: "NPCs", layout: [p("npc-list", 1, 4, 1), p("npc-card", 5, 8, 1)] },
    { id: "locations", label: "Locations", layout: [p("locations", 1, 4, 1), p("location-view", 5, 8, 1)] },
    { id: "monsters", label: "Monsters & custom entries", layout: [p("custom-entries", 1, 7, 1), p("stat-blocks", 8, 5, 1)] },
  ] },
  { id: "party", label: "Party", shortcut: "Alt+5", layout: [p("character-sheets", 1, 12, 1)] },
];

export const DASHBOARD_SHORTCUT = "Escape";

export function getMode(id: string | undefined): ModeDefinition | undefined {
  return MODES.find((m) => m.id === id);
}
