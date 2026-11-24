import { useEffect, useRef } from "react";

/** The one place keyboard shortcuts live. Combos look like "Alt+1" or "Escape".
 *  Registries are per window, so a key press only ever
 *  reaches the window that has focus: a shortcut can never fire in two windows. */

export interface Shortcut {
  combo: string;
  /** Human label, shown in hints and in conflict errors. */
  label: string;
  handler: () => void;
}

const registry = new Map<string, Shortcut>();
const handled = new WeakSet<Event>();

/** Claims: a panel can take a key from the registry while it has something in progress (Esc cancels a Line being drawn
 *  instead of leaving for the Dashboard). A claim beats the registered shortcut for the same combo, only while it is
 *  active, and never conflicts with it. The most recent claim wins. */
const claims: { combo: string; handler: () => void }[] = [];

const MODS = ["Ctrl", "Meta", "Alt", "Shift"] as const;

/** Canonical form: modifiers in fixed order, key last ("alt+1" -> "Alt+1"). */
export function normalizeCombo(combo: string): string {
  const parts = combo.split("+").map((s) => s.trim()).filter(Boolean);
  const key = parts.pop();
  if (!key) throw new Error(`Invalid shortcut: "${combo}"`);
  const mods = MODS.filter((m) => parts.some((p) => p.toLowerCase() === m.toLowerCase()));
  if (mods.length !== parts.length) throw new Error(`Invalid shortcut: "${combo}"`);
  return [...mods, key.length === 1 ? key.toUpperCase() : key].join("+");
}

/** The combo a keydown event represents. Letters and digits go by physical key, so Alt+1 works
 *  where Alt turns the key into another character (macOS). */
export function comboOf(e: KeyboardEvent): string {
  // "+" and "-" are named Plus and Minus (a combo splits on "+"). "=" counts as Plus, and Shift is ignored for both, so the
  // key works whether or not the layout needs Shift for "+"; the number pad's keys count too.
  const sign = e.key === "+" || e.key === "=" ? "Plus" : e.key === "-" || e.key === "_" ? "Minus" : null;
  const mods = MODS.filter((m) => e[`${m.toLowerCase()}Key` as "altKey"] && !(sign && m === "Shift"));
  if (sign) return [...mods, sign].join("+");
  const code = /^(?:Digit|Key)(.)$/.exec(e.code ?? "");
  const key = code ? code[1] : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [...mods, key].join("+");
}

/** Registers a shortcut and returns its unregister function. Throws when the combo is taken. */
export function registerShortcut(s: Shortcut): () => void {
  const combo = normalizeCombo(s.combo);
  const taken = registry.get(combo);
  if (taken) throw new Error(`Shortcut ${combo} is already used by "${taken.label}"; cannot register "${s.label}"`);
  const entry = { ...s, combo };
  registry.set(combo, entry);
  return () => { if (registry.get(combo) === entry) registry.delete(combo); };
}

export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

const dialogOpen = () => !!document.querySelector('[role="dialog"], dialog[open]');

/** Escape still leaves from a field of an editor form (those open with the cursor in them); the
 *  unsaved-changes guard (src/ui/unsaved.ts) asks first when something was typed. */
const escapeFromEditor = (e: KeyboardEvent) =>
  e.key === "Escape" && !!(e.target as HTMLElement | null)?.closest?.("form[data-guard-unsaved]");

/** Window-level keydown handler: skips typing and open dialogs, runs each event at most once.
 *  Since typing is already excluded, a bare key also triggers its Alt shortcut ("1" runs Alt+1). */
export function handleKeydown(e: KeyboardEvent) {
  if (handled.has(e) || e.defaultPrevented || e.isComposing || e.repeat) return;
  if ((isTyping(e.target) && !escapeFromEditor(e)) || dialogOpen()) return;
  const combo = comboOf(e);
  const claim = [...claims].reverse().find((c) => c.combo === combo);
  if (claim) { handled.add(e); e.preventDefault(); claim.handler(); return; }
  const s = registry.get(combo) ?? (combo.includes("+") ? undefined : registry.get(`Alt+${combo}`));
  if (!s) return;
  handled.add(e);
  e.preventDefault();
  s.handler();
}

/** Mount once per window (the Dashboard mounts it). */
export function useShortcutListener() {
  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);
}

/** Registers a shortcut while the component is mounted. A conflict throws, so it is never silent. */
export function useShortcut(combo: string, label: string, handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => registerShortcut({ combo, label, handler: () => ref.current() }), [combo, label]);
}

/** Every shortcut registered in this window, for the help dialog. */
export function listShortcuts(): { combo: string; label: string }[] {
  return [...registry.values()].map(({ combo, label }) => ({ combo, label }));
}

/** While `active`, this component's handler takes `combo` ahead of the registered shortcut (see `claims`). */
export function useShortcutClaim(combo: string, active: boolean, handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const claim = { combo: normalizeCombo(combo), handler: () => ref.current() };
    claims.push(claim);
    return () => { claims.splice(claims.indexOf(claim), 1); };
  }, [combo, active]);
}
