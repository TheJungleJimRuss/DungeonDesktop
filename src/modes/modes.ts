import type { DashboardEntry } from "../storage/db";

/** Where a panel sits in a Mode's grid (12 columns, rows auto-sized; 1-based lines). */
export interface PanelPlacement {
  panelId: string;
  col: number;
  colSpan: number;
  row: number;
  rowSpan: number;
}

export type ModeId = "combat" | "exploration" | "social" | "prep" | "party";

export interface ModeDefinition {
  id: ModeId;
  label: string;
  /** Combo that switches to this Mode (see src/shortcuts). */
  shortcut: string;
  /** The default arrangement . */
  layout: PanelPlacement[];
}

const p = (panelId: string, col: number, colSpan: number, row: number, rowSpan = 1): PanelPlacement => ({
  panelId, col, colSpan, row, rowSpan,
});

/** The Dashboard a Campaign shows until the DM customizes it (and after "Reset to default"). */
export const DASHBOARD_DEFAULT: DashboardEntry[] = [
  { panelId: "session-summary", x: 0, y: 0, w: 60, h: 60 },
  { panelId: "player-card", x: 60, y: 0, w: 60, h: 30 },
  { panelId: "pinned-notes", x: 60, y: 30, w: 60, h: 30 },
];

const PREP_ALL: PanelPlacement[] = [
  p("session-prep", 1, 3, 1, 2), p("npc-list", 4, 3, 1, 2), p("scratch-notes", 7, 3, 1, 2),
  p("locations", 10, 3, 1, 2), p("scenes", 1, 12, 3), p("custom-entries", 1, 12, 4),
];

export const MODES: ModeDefinition[] = [
  { id: "combat", label: "Combat", shortcut: "Alt+1",
    layout: [p("battle-map", 1, 6, 1, 2), p("initiative-tracker", 7, 6, 1), p("combatant-stat-block", 7, 3, 2), p("dice-roller", 10, 3, 2)] },
  { id: "exploration", label: "Exploration/Travel", shortcut: "Alt+2",
    layout: [p("world-map", 1, 8, 1, 2), p("player-card", 9, 4, 1), p("passive-perception", 9, 4, 2), p("route", 1, 12, 3)] },
  { id: "social", label: "Social/Roleplay", shortcut: "Alt+3",
    layout: [p("social-npc-list", 1, 4, 1, 3), p("scenes", 5, 4, 1, 2), p("scratch-notes", 5, 4, 3), p("player-card", 9, 4, 1), p("pinned-notes", 9, 4, 2, 2)] },
  { id: "prep", label: "Prep", shortcut: "Alt+4", layout: PREP_ALL },
  { id: "party", label: "Party", shortcut: "Alt+5", layout: [p("character-sheets", 1, 12, 1)] },
];

export const DASHBOARD_SHORTCUT = "Escape";

export function getMode(id: string | undefined): ModeDefinition | undefined {
  return MODES.find((m) => m.id === id);
}
