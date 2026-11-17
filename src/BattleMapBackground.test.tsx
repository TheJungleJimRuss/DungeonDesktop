import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { exportCampaign, importCampaign, listCampaigns, parseCampaignFile } from "./storage";
import { getBattleMap } from "./storage/battleMaps";
import { setImageResizer } from "./storage/imageResize";
import { getDb } from "./storage/db";

type User = ReturnType<typeof userEvent.setup>;
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const png = (name = "bg.png") => new File([PNG], name, { type: "image/png" });

const created: Blob[] = [];
beforeEach(() => {
  localStorage.clear();
  created.length = 0;
  let n = 0;
  URL.createObjectURL = vi.fn((b: Blob) => (created.push(b), `blob:bg-${n++}`));
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { vi.restoreAllMocks(); setImageResizer(null); });

async function openMap(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}1{/Alt}");
  await screen.findByRole("heading", { name: /^combat$/i });
  await user.click(screen.getByRole("button", { name: /start encounter/i }));
  const id = (await listCampaigns())[0].id;
  const map = within(await screen.findByRole("region", { name: "Battle Map" }));
  await map.findByLabelText("Grid width");
  return { id, map };
}
const encounterId = async () => (await (await getDb()).getAll("encounters"))[0].id as string;
const image = () => document.querySelector<SVGImageElement>(".battle-grid image");
const setVal = async (user: User, el: HTMLElement, v: string) => { await user.clear(el); await user.type(el, v + "{Tab}"); };

describe("Battle Map background image", () => {
  it("sets, scales, offsets, replaces and clears an image; grid stays over it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { map } = await openMap(user);
    expect(image()).toBeNull();
    expect(map.queryByRole("button", { name: /clear background/i })).not.toBeInTheDocument();

    await user.upload(map.getByLabelText("Background image"), png());
    await waitFor(() => expect(image()).not.toBeNull());
    expect(image()!.getAttribute("href")).toMatch(/^blob:/);
    const eid = await encounterId();
    const stored = (await getBattleMap(eid))!.background!;
    expect(stored.image!.data.byteLength).toBe(PNG.length);
    expect(stored.image!.type).toBe("image/png");
    // the image is drawn before (under) the grid lines
    const svg = document.querySelector(".battle-grid")!;
    const kids = [...svg.children];
    expect(kids.indexOf(image()!)).toBeLessThan(kids.indexOf(svg.querySelector(".grid-line")!));

    await setVal(user, map.getByLabelText("Background scale"), "1.5");
    await setVal(user, map.getByLabelText("Background offset X"), "2");
    await setVal(user, map.getByLabelText("Background offset Y"), "3");
    await waitFor(async () => expect((await getBattleMap(eid))!.background).toMatchObject({ scale: 1.5, offsetX: 2, offsetY: 3 }));
    expect(image()).toHaveAttribute("x", "80");
    expect(image()).toHaveAttribute("y", "120");

    // replacing keeps the placement and revokes the old object URL
    await user.upload(map.getByLabelText("Background image"), png("other.png"));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalled());
    expect((await getBattleMap(eid))!.background).toMatchObject({ scale: 1.5, offsetX: 2 });

    await user.click(map.getByRole("button", { name: /clear background/i }));
    await waitFor(() => expect(image()).toBeNull());
    expect((await getBattleMap(eid))!.background?.image).toBeUndefined();
  });

  it("round-trips through export/import as a data URL and keeps older files importable", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await openMap(user);
    await user.upload(map.getByLabelText("Background image"), png());
    const eid = await encounterId();
    await waitFor(async () => expect((await getBattleMap(eid))?.background?.image).toBeTruthy());
    await setVal(user, map.getByLabelText("Background scale"), "2");
    await waitFor(async () => expect((await getBattleMap(eid))!.background?.scale).toBe(2));

    const doc = (await exportCampaign(id))!;
    const text = JSON.stringify(doc);
    expect(text).toContain("data:image/png;base64,");
    const parsed = parseCampaignFile(text);
    expect(parsed.ok).toBe(true);
    const db = await getDb();
    await db.delete("battleMaps", eid);
    if (parsed.ok) await importCampaign(parsed.data);
    const back = (await getBattleMap(eid))!.background!;
    expect(back.scale).toBe(2);
    expect(back.image!.data.byteLength).toBe(PNG.length);
    expect(back.image!.type).toBe("image/png");
    expect(new Uint8Array(back.image!.data)).toEqual(PNG);

    // a file without any background (an older export) still imports
    const old = JSON.parse(text);
    delete old.collections.battleMaps[0].background;
    const p2 = parseCampaignFile(JSON.stringify(old));
    expect(p2.ok).toBe(true);
    if (p2.ok) await importCampaign(p2.data);
    expect((await getBattleMap(eid))!.background).toBeUndefined();
  });

  it("saved encounters carry the image; ending the Encounter leaves no orphan", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { id, map } = await openMap(user);
    await user.upload(map.getByLabelText("Background image"), png());
    const eid = await encounterId();
    await waitFor(async () => expect((await getBattleMap(eid))?.background?.image).toBeTruthy());
    await user.type(screen.getByLabelText("Ad-hoc name"), "Bandit");
    await user.type(screen.getByLabelText("Ad-hoc HP"), "11");
    await user.click(screen.getByRole("button", { name: /add ad-hoc/i }));
    await user.type(screen.getByLabelText("Saved encounter name"), "Ambush");
    await user.click(screen.getByRole("button", { name: /save encounter/i }));
    await waitFor(async () => expect((await exportCampaign(id))!.collections.savedEncounters).toHaveLength(1));
    expect(JSON.stringify((await exportCampaign(id))!.collections.savedEncounters)).toContain("data:image/png;base64,");

    await user.click(screen.getByRole("button", { name: /end encounter/i }));
    await waitFor(async () => expect(await (await getDb()).getAll("battleMaps")).toHaveLength(0));
    await user.click(within(await screen.findByRole("listitem", { name: "Ambush" })).getByRole("button", { name: /^load/i }));
    await waitFor(() => expect(image()).not.toBeNull());
    const neid = await encounterId();
    expect((await getBattleMap(neid))!.background!.image!.data.byteLength).toBe(PNG.length);
  });

  it("stores what the resizer returns for a large image, and the original when it declines or fails", async () => {
    const user = userEvent.setup();
    render(<App />);
    const { map } = await openMap(user);
    const eid = await encounterId();
    const small = { type: "image/webp", data: new Uint8Array([1, 2, 3]).buffer };
    const seen: number[] = [];
    setImageResizer(async (_f, max) => (seen.push(max), small));
    await user.upload(map.getByLabelText("Background image"), png());
    await waitFor(async () => expect((await getBattleMap(eid))?.background?.image?.type).toBe("image/webp"));
    expect(seen).toEqual([2048]);
    expect((await getBattleMap(eid))!.background!.image!.data.byteLength).toBe(3);

    setImageResizer(async () => null); // small enough, or no canvas APIs: keep the file as chosen
    await user.upload(map.getByLabelText("Background image"), png("again.png"));
    await waitFor(async () => expect((await getBattleMap(eid))!.background!.image!.type).toBe("image/png"));
    expect((await getBattleMap(eid))!.background!.image!.data.byteLength).toBe(PNG.length);

    setImageResizer(async () => small);
    await user.upload(map.getByLabelText("Background image"), png("x.png"));
    await waitFor(async () => expect((await getBattleMap(eid))!.background!.image!.type).toBe("image/webp"));
    setImageResizer(async () => { throw new Error("decode failed"); });
    await user.upload(map.getByLabelText("Background image"), png("y.png"));
    await waitFor(async () => expect((await getBattleMap(eid))!.background!.image!.type).toBe("image/png"));
  });
});
