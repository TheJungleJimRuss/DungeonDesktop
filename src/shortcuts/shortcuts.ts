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
  const mods = MODS.filter((m) => e[`${m.toLowerCase()}Key` as "altKey"]);
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

/** Window-level keydown handler: skips typing and open dialogs, runs each event at most once.
 *  Since typing is already excluded, a bare key also triggers its Alt shortcut ("1" runs Alt+1). */
export function handleKeydown(e: KeyboardEvent) {
  if (handled.has(e) || e.defaultPrevented || e.isComposing || e.repeat) return;
  if (isTyping(e.target) || dialogOpen()) return;
  const combo = comboOf(e);
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
