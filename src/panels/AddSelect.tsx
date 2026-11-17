export interface AddOption { value: string; label: string }

/** One dropdown that adds the chosen option on selection, then resets to its prompt. */
export default function AddSelect({ label, prompt, options, onPick, extra }: {
  label: string; prompt: string; options: AddOption[]; onPick: (value: string) => void;
  /** Options placed above the list (e.g. "Add everyone"). */
  extra?: AddOption[];
}) {
  return (
    <select className="add-select" aria-label={label} value="" disabled={options.length === 0}
      onChange={(e) => { if (e.target.value) onPick(e.target.value); }}>
      <option value="">{options.length === 0 ? `${prompt} (none available)` : prompt}</option>
      {extra?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
