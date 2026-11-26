import { useEffect, useState } from "react";
import { nothingRead, type ReadResult } from "./normalize";

/** "Paste stat block" dialog shared by the spell, item and monster editors. `read` is one of the pure readers;
 *  a read with something in it goes to `onFill` and the dialog closes, an empty one keeps it open with a message. */
export function PasteDialog<T>({ read, onFill, onClose }: { read: (text: string) => ReadResult<T>; onFill: (r: ReadResult<T>) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const fill = () => {
    const r = read(text);
    if (nothingRead(r)) { setEmpty(true); return; }
    onFill(r);
    onClose();
  };
  return (
    <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Paste stat block" className="dialog">
        <h2>Paste stat block</h2>
        <label className="ce-field ce-wide">
          <span>Stat block text</span>
          <textarea autoFocus rows={12} value={text} onChange={(e) => { setText(e.target.value); setEmpty(false); }} />
        </label>
        {empty && <p role="alert">Nothing in that text could be read.</p>}
        <div className="row end">
          <button type="button" className="primary" onClick={fill}>Fill</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** Notice listing lines a Fill could not place; renders nothing when there are none. */
export function UnreadNotice({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div role="region" aria-label="Lines not read" className="ce-unread">
      <p><strong>Lines not read</strong></p>
      <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </div>
  );
}
