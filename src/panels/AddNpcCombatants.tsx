import { monsterCombatants } from "./CombatExtras";
import AddSelect from "./AddSelect";
import { useNpcs } from "../storage/npcs";
import { useCustomEntries } from "../storage/customEntries";
import { resolveNpcStatBlock } from "../srd/npcStatBlock";
import { abilityMod, type NewCombatant } from "../combat/rules";

/** Adds NPCs that have a linked Stat Block to the Encounter, using that Stat Block under the NPC's name. */
export default function AddNpcCombatants({ campaignId, onAdd }: { campaignId: string; onAdd: (c: NewCombatant[]) => void }) {
  const npcs = useNpcs(campaignId);
  const customs = useCustomEntries(campaignId);
  const linked = (npcs ?? []).filter((n) => n.statBlockId);
  if (!linked.length) return null;
  const add = async (id: string) => {
    const n = linked.find((x) => x.id === id);
    if (!n) return;
    const r = await resolveNpcStatBlock(n, customs ?? []);
    if (r.status !== "ok") return;
    onAdd(monsterCombatants(r.monster, { kind: "monster", name: r.monster.name, hp: r.monster.hp, dexMod: abilityMod(r.monster.abilities.dex), monsterId: n.statBlockId }));
  };
  return (
    <AddSelect label="Add NPC" prompt="Add NPC…" options={linked.map((n) => ({ value: n.id, label: n.name }))} onPick={(id) => void add(id)} />
  );
}
