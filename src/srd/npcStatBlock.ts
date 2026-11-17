import { getMonster, type Monster } from "./monsters";
import { CUSTOM_PREFIX, monsterFromEntry, type CustomEntry } from "../storage/customEntries";

export type NpcStatBlock =
  | { status: "none" }
  | { status: "missing" }
  | { status: "ok"; monster: Monster; sourceName: string };

/** Resolves an NPC's linked Stat Block (SRD id or `custom:<id>`). The returned monster carries the NPC's name,
 *  ready for the combat setup to add as a combatant; `sourceName` is the Stat Block's own name. */
export async function resolveNpcStatBlock(
  npc: { name: string; statBlockId?: string },
  customs: CustomEntry[],
): Promise<NpcStatBlock> {
  const id = npc.statBlockId;
  if (!id) return { status: "none" };
  let found: Monster | undefined;
  if (id.startsWith(CUSTOM_PREFIX)) {
    const e = customs.find((c) => c.id === id.slice(CUSTOM_PREFIX.length) && c.kind === "monster");
    found = e && monsterFromEntry(e);
  } else found = await getMonster(id);
  if (!found) return { status: "missing" };
  return { status: "ok", monster: { ...found, name: npc.name || found.name }, sourceName: found.name };
}
