import { isDefeated, type Combatant } from "./rules";

/** Total XP of the defeated monster combatants. Ad-hoc, lair and unknown monsters count 0. */
export function defeatedMonsterXp(combatants: Combatant[], xpById: Map<string, number>): number {
  return combatants.reduce((sum, c) => sum + (c.kind === "monster" && c.monsterId && isDefeated(c) ? xpById.get(c.monsterId) ?? 0 : 0), 0);
}

/** Even share per Party combatant, rounded down; 0 with no Party combatants. */
export const xpShare = (total: number, partyCount: number): number => (partyCount > 0 && total > 0 ? Math.floor(total / partyCount) : 0);
