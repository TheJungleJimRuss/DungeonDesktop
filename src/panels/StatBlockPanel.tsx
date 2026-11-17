import { useEffect, useState } from "react";
import { registerPanel, type PanelProps } from "./registry";
import { getMonster, type Monster } from "../srd/monsters";
import { parseRefSelection, selectStatBlock, useSelectedStatBlock } from "../srd/selection";
import { RefSelectionBody } from "../srd/ReferenceCards";
import StatBlock from "../srd/StatBlock";
import { SRD_CHANGES } from "../srd/attribution";
import { ItemCard, SpellCard } from "../srd/CustomCards";
import {
  CUSTOM_PREFIX, customSelectionId, duplicateMonster, monsterFromEntry, useCustomEntries,
  type CustomEntry, type ItemData, type SpellData,
} from "../storage/customEntries";

/** A selected custom entry (id `custom:<id>`), live: edits and deletes show without reload. */
function CustomBody({ campaign, id }: { campaign: PanelProps["campaign"]; id: string }) {
  const entries = useCustomEntries(campaign.id);
  if (!entries) return <p className="muted">Loading Stat Block…</p>;
  const e: CustomEntry | undefined = entries.find((x) => customSelectionId(x.id) === id);
  if (!e) return <p className="muted">That custom entry no longer exists.</p>;
  return (
    <>
      {e.kind === "monster" && <StatBlock monster={monsterFromEntry(e)} />}
      {e.kind === "spell" && <SpellCard name={e.name} spell={e.data as SpellData} />}
      {e.kind === "item" && <ItemCard name={e.name} item={e.data as ItemData} />}
      <p className="muted sb-credit">Custom {e.kind}, made in this Campaign.</p>
    </>
  );
}

function StatBlockBody({ campaign }: PanelProps) {
  const id = useSelectedStatBlock(campaign.id);
  const [monster, setMonster] = useState<Monster | null | undefined>();
  const custom = !!id && id.startsWith(CUSTOM_PREFIX);
  useEffect(() => {
    let live = true;
    setMonster(undefined);
    if (id && !custom) void getMonster(id).then((m) => live && setMonster(m ?? null));
    return () => { live = false; };
  }, [id, custom]);
  if (!id) return <p className="muted">Search (Ctrl or Cmd + K) for a creature, spell, item or condition to show it here.</p>;
  const ref = parseRefSelection(id);
  if (ref) return <RefSelectionBody type={ref.type} id={ref.id} />;
  if (custom) return <CustomBody campaign={campaign} id={id} />;
  if (monster === undefined) return <p className="muted">Loading Stat Block…</p>;
  if (monster === null) return <p className="muted">That creature is no longer in the SRD data.</p>;
  const duplicate = async () => selectStatBlock(campaign.id, customSelectionId((await duplicateMonster(campaign.id, monster)).id));
  return (
    <>
      <StatBlock monster={monster} />
      <button onClick={() => void duplicate()}>Duplicate as custom</button>
      <p className="muted sb-credit">Source: SRD 5.2.1, CC BY 4.0. {SRD_CHANGES}</p>
    </>
  );
}

registerPanel({ id: "stat-blocks", title: "Stat Blocks", notOnDashboard: true, component: StatBlockBody });
