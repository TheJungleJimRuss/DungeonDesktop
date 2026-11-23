import { useEffect, useRef, useState } from "react";
import type { PartyMember } from "../storage/party";
import { awardXp, setXp } from "../party/recompute";
import { nextLevelXp } from "../party/xp";

type LevelChange = { before: number; after: number } | null;
const fmt = (n: number) => n.toLocaleString("en-US");

/** Current XP with the next threshold, and a box to award more. With `editableTotal` the total itself is an input
 *  (commits on Enter or blur) so the DM can correct it either way. A level change re-runs the auto fields. */
export default function XpAward({ m, editableTotal = false }: { m: PartyMember; editableTotal?: boolean }) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const hasXp = Number.isFinite(m.xp);
  const [total, setTotal] = useState(hasXp ? String(m.xp) : "");
  useEffect(() => { setAmount(""); setStatus(""); }, [m.id]);
  // While the DM is typing, a reload of `m` (e.g. from their own Enter commit) must not overwrite the field.
  const editing = useRef(false);
  const committed = useRef<number | null>(null);
  useEffect(() => { if (!editing.current) setTotal(hasXp ? String(m.xp) : ""); }, [m.id, m.xp, hasXp]);
  const next = hasXp ? nextLevelXp(m.xp!) : undefined;
  const report = (r: LevelChange) =>
    setStatus(!r || r.after === r.before ? "" : r.after > r.before ? `Level up! Now level ${r.after}` : `Now level ${r.after}`);
  const award = async () => {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return;
    report(await awardXp(m.id, n));
    setAmount("");
  };
  const commitTotal = async () => {
    const n = Math.floor(Number(total));
    if (total.trim() === "" || !Number.isFinite(n) || n < 0) { setTotal(hasXp ? String(m.xp) : ""); return; }
    if (n === m.xp || n === committed.current) return;
    committed.current = n;
    report(await setXp(m.id, n));
  };
  return (
    <div className="xp-award">
      {editableTotal ? (
        <>
          <label className="xp-total">XP{" "}
            <input type="number" min={0} value={total} aria-label={`Total XP ${m.name}`} placeholder="0" onChange={(e) => { committed.current = null; setTotal(e.target.value); }}
              onFocus={() => { editing.current = true; }}
              onBlur={() => { editing.current = false; void commitTotal(); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commitTotal(); } }} />
          </label>
          {hasXp && <span className="muted">{next ? `/ ${fmt(next)}` : "(max level)"}</span>}
        </>
      ) : (
        hasXp && <span className="muted" aria-label={`XP ${m.name}`}>XP {fmt(m.xp!)}{next ? ` / ${fmt(next)}` : " (max level)"}</span>
      )}
      <input type="number" min={1} value={amount} aria-label={`XP to award ${m.name}`} placeholder="+XP" onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void award(); } }} />
      <button type="button" aria-label={`Award XP ${m.name}`} onClick={() => void award()}>Award XP</button>
      <span role="status" className="xp-status">{status}</span>
    </div>
  );
}
