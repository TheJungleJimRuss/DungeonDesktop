/** Map panel keys. Single letters, claimed by the Map panel while it is shown (never registered, so they cannot clash with
 *  the window's shortcuts); like every shortcut they are ignored while typing or with a dialog open. S, D and 1-5 are taken
 *  by the window (Stat Blocks, Dice, Modes), so the tools avoid them. */
export type Tool = "select" | "draw" | "marker" | "ruler";

export const TOOL_KEYS: Record<Tool, string> = { select: "V", draw: "L", marker: "P", ruler: "M" };
export const FIT_KEY = "F";
export const BATTLE_KEY = "0";
export const FIND_KEY = "/";

/** For the shortcut help dialog. */
export const MAP_KEYS: { keys: string[]; label: string }[] = [
  { keys: [TOOL_KEYS.select], label: "Select tool" },
  { keys: [TOOL_KEYS.draw], label: "Draw tool (Lines and Shapes)" },
  { keys: [TOOL_KEYS.marker], label: "Marker tool (pin)" },
  { keys: [TOOL_KEYS.ruler], label: "Ruler (measure)" },
  { keys: ["Shift"], label: "Hold while finishing to keep the tool (otherwise back to Select)" },
  { keys: ["Enter"], label: "Finish the Line being drawn" },
  { keys: ["Esc"], label: "Cancel drawing, clear the measurement, drop the selection, then back to Select" },
  { keys: ["Delete", "Backspace"], label: "Delete the selection" },
  { keys: ["+", "-"], label: "Zoom in / out" },
  { keys: [BATTLE_KEY], label: "Battle scale (1x) at the view centre" },
  { keys: [FIT_KEY], label: "Fit all" },
  { keys: [FIND_KEY], label: "Find on map" },
  { keys: ["Arrows"], label: "Move the focused Token or Party token" },
];
