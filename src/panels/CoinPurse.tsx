import { useState } from "react";
import { updatePartyMember, type PartyMember } from "../storage/party";
import { CURRENCIES, NO_COINS, adjustCoins, type Currency } from "../party/sheet";

/**
 * Coin you can change in place: each amount is editable (saves on blur or Enter),
 * and a Gain/Spend box adds or takes coins without doing the sum yourself.
 */
export default function CoinPurse({ m }: { m: PartyMember }) {
  const coins = { ...NO_COINS, ...m.coins };
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("gp");
  const [error, setError] = useState("");

  const setOne = (c: Currency, raw: string) => {
    const n = Math.max(0, Math.floor(Number(raw)) || 0);
    if (n !== coins[c]) void updatePartyMember(m.id, { coins: { ...coins, [c]: n } });
  };
  const change = (sign: 1 | -1) => {
    const n = Math.floor(Number(amount));
    if (!n || n < 0) return;
    const next = adjustCoins(coins, currency, sign * n);
    if (!next) { setError(`Not enough ${currency} (has ${coins[currency]}).`); return; }
    setError("");
    setAmount("");
    void updatePartyMember(m.id, { coins: next });
  };

  return (
    <div className="coin-purse">
      <div className="player-coins">
        {CURRENCIES.map((c) => (
          <label key={c}><span className="muted">{c}</span>
            <input type="number" min={0} aria-label={`${c} ${m.name}`} defaultValue={coins[c]} key={`${c}-${coins[c]}`}
              onBlur={(e) => setOne(c, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
          </label>
        ))}
      </div>
      <form className="coin-change" onSubmit={(e) => { e.preventDefault(); change(1); }}>
        <input type="number" min={1} placeholder="Amount" aria-label={`Coin amount for ${m.name}`} value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(""); }} />
        <select aria-label={`Coin type for ${m.name}`} value={currency} onChange={(e) => { setCurrency(e.target.value as Currency); setError(""); }}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit">Gain</button>
        <button type="button" onClick={() => change(-1)}>Spend</button>
      </form>
      {error && <p className="dice-error" role="alert">{error}</p>}
    </div>
  );
}
