/**
 * Cross-window change bus. IndexedDB has no change events across windows, so every
 * write announces itself here and every data hook listens here. Messages travel over a
 * BroadcastChannel (falling back to in-process only where it is missing, e.g. tests).
 *
 * Wiring a new collection (locations, sessions, ...) is ONE line, and usually zero:
 *  - Writes: nothing to do. `getDb()` (storage/db.ts) wraps every add/put/delete/clear and
 *    every readwrite transaction, and calls `notifyChange(storeName)` for you.
 *  - Reads: in the hook that loads the collection, add
 *      `useEffect(() => onChange("<collection>", load), [...])`   // onChange returns an unsubscribe
 *    or, in a component, `const version = useChangeVersion("<collection>")` and put
 *    `version` in the load effect's dependencies.
 *  - Non-IndexedDB shared state (e.g. localStorage keys): call `notifyChange("<name>")`
 *    after writing and subscribe with the same name.
 */
import { useEffect, useState } from "react";

export const CHANNEL_NAME = "dungeon-desktop:changes";
export const ANY = "*";

export interface ChannelLike {
  postMessage(message: unknown): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  close?(): void;
}
export type ChannelFactory = (name: string) => ChannelLike | null;

const nativeFactory: ChannelFactory = (name) =>
  typeof BroadcastChannel === "undefined" ? null : (new BroadcastChannel(name) as unknown as ChannelLike);

export interface ChangeBus {
  notifyChange(name: string): void;
  onChange(name: string, cb: () => void): () => void;
  /** Test hook: swap the channel (null = in-process only). */
  setChannelFactory(factory: ChannelFactory): void;
}

export function createChangeBus(factory: ChannelFactory = nativeFactory): ChangeBus {
  const listeners = new Map<string, Set<() => void>>();
  let channel: ChannelLike | null = null;

  const fire = (name: string) => {
    for (const key of [name, ANY]) listeners.get(key)?.forEach((cb) => cb());
  };
  const open = () => {
    channel?.close?.();
    channel = factory(CHANNEL_NAME);
    if (channel) {
      channel.onmessage = (e) => {
        const name = (e.data as { name?: unknown } | null)?.name;
        if (typeof name === "string") fire(name);
      };
    }
  };
  open();

  return {
    notifyChange(name) {
      fire(name);
      try { channel?.postMessage({ name }); } catch { /* channel closed: local only */ }
    },
    onChange(name, cb) {
      let set = listeners.get(name);
      if (!set) listeners.set(name, (set = new Set()));
      set.add(cb);
      return () => { set.delete(cb); };
    },
    setChannelFactory(f) { factory = f; open(); },
  };
}

const bus = createChangeBus();
export const notifyChange = bus.notifyChange;
export const onChange = bus.onChange;
export const setChannelFactory = bus.setChannelFactory;

/** Number that bumps whenever any of the named collections change (in any window). */
export function useChangeVersion(...names: string[]): number {
  const [version, setVersion] = useState(0);
  const key = names.join("|");
  useEffect(() => {
    const offs = key.split("|").map((n) => onChange(n, () => setVersion((v) => v + 1)));
    return () => offs.forEach((off) => off());
  }, [key]);
  return version;
}
