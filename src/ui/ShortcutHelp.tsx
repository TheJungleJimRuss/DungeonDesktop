import { useEffect, useRef } from "react";
import { listShortcuts } from "../shortcuts/shortcuts";

/** Lists the shortcuts registered in this window. Opened with "?" or the top-bar button. */
export default function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows = listShortcuts().filter((r) => r.combo !== "?"); // "?" duplicates "Shift+?" for layouts that report no Shift
  return (
    <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="sc-title" className="dialog">
        <h2 id="sc-title">Keyboard shortcuts</h2>
        <dl className="shortcut-list">
          {rows.map((r) => (<div key={r.combo}><dt>{r.label}</dt><dd>{r.combo.startsWith("Alt+") && !r.combo.slice(4).includes("+") ? <><kbd>{r.combo.slice(4)}</kbd> or <kbd>{r.combo}</kbd></> : <kbd>{r.combo}</kbd>}</dd></div>))}
        </dl>
        <div className="row end"><button ref={closeRef} onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
