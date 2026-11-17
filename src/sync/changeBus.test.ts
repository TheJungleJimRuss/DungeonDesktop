import { createChangeBus, type ChannelLike } from "./changeBus";

/** Fake BroadcastChannel: delivers to every other instance on the same name, never to itself. */
function loopback() {
  const all = new Set<FakeChannel>();
  class FakeChannel implements ChannelLike {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    constructor() { all.add(this); }
    postMessage(data: unknown) { all.forEach((c) => c !== this && c.onmessage?.({ data })); }
    close() { all.delete(this); }
  }
  return () => new FakeChannel();
}

describe("change bus", () => {
  it("notifies local listeners and listeners in another window, but only for the named collection", () => {
    const factory = loopback();
    const a = createChangeBus(factory);
    const b = createChangeBus(factory);
    const seenA = vi.fn(), seenB = vi.fn(), other = vi.fn(), any = vi.fn();
    a.onChange("party", seenA);
    b.onChange("party", seenB);
    b.onChange("npcs", other);
    b.onChange("*", any);
    a.notifyChange("party");
    expect(seenA).toHaveBeenCalledTimes(1);
    expect(seenB).toHaveBeenCalledTimes(1);
    expect(any).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe and works without BroadcastChannel", () => {
    const bus = createChangeBus(() => null);
    const cb = vi.fn();
    const off = bus.onChange("notes", cb);
    bus.notifyChange("notes");
    off();
    bus.notifyChange("notes");
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
