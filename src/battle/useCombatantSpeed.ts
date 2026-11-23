import { useEffect, useState } from "react";
import type { Combatant } from "../combat/rules";
import { getMonster } from "../srd/monsters";
import { CUSTOM_PREFIX, monsterFromEntry, useCustomEntries } from "../storage/customEntries";
import { listParty } from "../storage/party";
import { useChangeVersion } from "../sync/changeBus";
import { walkSpeedFeet } from "./speed";

/** Walking speed in feet of a combatant (Party sheet or Stat Block); null when unknown or none given. */
export function useCombatantSpeed(campaignId: string, c: Combatant | undefined): number | null {
  const [text, setText] = useState<string | undefined>();
  const partyVersion = useChangeVersion("party");
  const customs = useCustomEntries(campaignId);
  const monsterId = c?.kind === "monster" ? c.monsterId : undefined;
  const custom = !!monsterId && monsterId.startsWith(CUSTOM_PREFIX);
  useEffect(() => {
    let live = true;
    setText(undefined);
    if (c?.kind === "party") {
      void listParty(campaignId).then((l) => { if (live) setText((l.find((m) => m.id === c.partyId) ?? l.find((m) => m.name === c.name))?.speed); });
    } else if (monsterId && !custom) {
      void getMonster(monsterId).then((m) => { if (live) setText(m?.speed); });
    }
    return () => { live = false; };
  }, [campaignId, c?.kind, c?.partyId, c?.name, monsterId, custom, partyVersion]);
  if (custom) {
    const e = customs?.find((x) => x.id === monsterId!.slice(CUSTOM_PREFIX.length) && x.kind === "monster");
    return walkSpeedFeet(e ? monsterFromEntry(e).speed : undefined);
  }
  return walkSpeedFeet(text);
}
