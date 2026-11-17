import { useState } from "react";
import { STYLES, generateNames, type NameStyleId } from "./names";

const COUNT = 6;

/** Name ideas for the NPC form: hidden behind a button until needed; picking one calls onPick. */
export default function NameSuggestions({ onPick }: { onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<NameStyleId>("any");
  const [names, setNames] = useState<string[]>([]);
  const reroll = (s: NameStyleId = style) => setNames(generateNames(Math.random, s, COUNT));

  if (!open) {
    return (
      <div className="row">
        <button type="button" onClick={() => { reroll(); setOpen(true); }}>Suggest names</button>
      </div>
    );
  }
  return (
    <section className="name-suggestions" aria-label="Name suggestions">
      <div className="row">
        <select className="grow" aria-label="Name style" value={style}
          onChange={(e) => { const s = e.target.value as NameStyleId; setStyle(s); reroll(s); }}>
          {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button type="button" onClick={() => reroll()}>Reroll</button>
        <button type="button" onClick={() => setOpen(false)}>Hide</button>
      </div>
      <ul className="name-suggestion-list">
        {names.map((n) => (
          <li key={n}>
            <button type="button" className="gen-name" aria-label={`Use name ${n}`}
              onClick={() => { onPick(n); setOpen(false); }}>{n}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
