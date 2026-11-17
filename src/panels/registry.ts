import type { ComponentType } from "react";
import type { Campaign } from "../storage";

/** Props every panel receives. A panel must render from these alone (plus its own
 *  storage reads), so the same panel can later be mounted in a Pop-out Window. */
export interface PanelProps {
  campaign: Campaign;
}

/** A self-contained unit of UI. `id` is stable (lowercase-kebab) and never reused. */
export interface PanelDefinition {
  id: string;
  title: string;
  component: ComponentType<PanelProps>;
}

const panels = new Map<string, PanelDefinition>();

export function registerPanel(def: PanelDefinition): PanelDefinition {
  // Dev hot-reload re-runs module bodies; replace instead of throwing there.
  if (panels.has(def.id) && !import.meta.hot) throw new Error(`Duplicate panel id: ${def.id}`);
  panels.set(def.id, def);
  return def;
}

export function getPanel(id: string): PanelDefinition {
  const def = panels.get(id);
  if (!def) throw new Error(`Unknown panel id: ${id}`);
  return def;
}
