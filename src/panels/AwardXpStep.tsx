import { useEffect, useMemo, useState } from "react";
import { loadMonsters } from "../srd/monsters";
import { monsterFromEntry, useCustomEntries } from "../storage/customEntries";
import { awardXp } from "../party/recompute";
import { defeatedMonsterXp, xpShare } from "../combat/xpAward";
import type { Encounter } from "../combat/rules";

/** Inline step shown after "Yes, end it": the defeated monsters' XP, editable, split evenly among the Party combatants. */
export default function AwardXpStep({ campaignId, enc, onFinish }: { campaignId: string; enc: Encounter; onFinish: (award: (() => Promise<void>) | null) => void }) {
  const customs = useCustomEntries(campaignId);
  const [srdXp, setSrdXp] = useState<Map<string, number>>(new Map());
  useEffect(() => { void loadMonsters().then((ms) => setSrdXp(new Map(ms.map((m) => [m.id, m.xp])))); }, []);
  const suggested = useMemo(() => {
    const all = new Map(srdXp);
    for (const e of customs ?? []) if (e.kind === "monster") { const m = monsterFromEntry(e); all.set(m.id, m.xp); }
    return defeatedMonsterXp(enc.combatants, all);
  }, [srdXp, customs, enc.combatants]);
  const [draft, setDraft] = useState<string | null>(null); // null = follow the suggestion until the DM types
  const partyIds = enc.combatants.flatMap((c) => (c.kind === "party" && c.partyId ? [c.partyId] : []));
  const total = Math.max(0, Math.floor(Number(draft ?? suggested)) || 0);
  const share = xpShare(total, partyIds.length);
  const names = enc.combatants.filter((c) => c.kind === "party" && c.partyId).map((c) => c.name);
  return (
    <div className="award-xp" role="dialog" aria-label="Award XP to party">
      <strong>Award XP to party</strong>
      <label>Total XP
        <input type="number" min={0} value={draft ?? String(suggested)} onChange={(e) => setDraft(e.target.value)} />
      </label>
      <span>{share} XP each (split {partyIds.length} {partyIds.length === 1 ? "way" : "ways"})</span>
      <ul aria-label="XP split">{names.map((n, i) => <li key={i}>{n}: {share} XP</li>)}</ul>
      <button className="primary"
        onClick={() => onFinish(async () => { if (share > 0) for (const id of partyIds) await awardXp(id, share); })}>Award and end</button>
      <button onClick={() => onFinish(null)}>End without XP</button>
    </div>
  );
}
