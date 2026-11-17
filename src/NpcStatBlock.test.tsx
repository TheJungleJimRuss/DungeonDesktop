import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { setMonsterSource } from "./srd/monsters";
import { setReferenceSource } from "./srd/reference";
import { FIXTURE_MONSTERS, FIXTURE_REFERENCE } from "./srd/fixtures";
import { listNpcs } from "./storage/npcs";
import { getDb } from "./storage/db";
import { resolveNpcStatBlock } from "./srd/npcStatBlock";

type User = ReturnType<typeof userEvent.setup>;
let blobs: Blob[] = [];
beforeEach(() => {
  blobs = [];
  localStorage.clear();
  setMonsterSource(async () => FIXTURE_MONSTERS);
  setReferenceSource(async () => FIXTURE_REFERENCE);
  URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), "blob:test"));
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { setMonsterSource(null); setReferenceSource(null); vi.restoreAllMocks(); });

async function openPrep(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  await user.keyboard("{Alt>}4{/Alt}");
  await screen.findByRole("region", { name: /^npcs$/i });
}
const list = () => screen.getByRole("region", { name: /^npcs$/i });
const card = () => screen.getByRole("region", { name: /npc card/i });
async function newNpc(user: User, name: string) {
  await user.click(within(list()).getByRole("button", { name: /new npc/i }));
  await user.type(within(card()).getByLabelText(/^name/i), name);
  await user.click(within(card()).getByRole("button", { name: /save/i }));
  await within(card()).findByRole("heading", { name });
}
async function linkVia(user: User, query: string, hit: RegExp) {
  await user.click(within(card()).getByRole("button", { name: /link stat block/i }));
  const dlg = await screen.findByRole("dialog", { name: /link stat block/i });
  await user.type(within(dlg).getByRole("searchbox"), query);
  await user.click(await within(dlg).findByRole("button", { name: hit }));
}

describe("NPC Stat Block link", () => {
  it("links an SRD Stat Block by search, shows it on the card, and unlinks", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPrep(user);
    await newNpc(user, "Elda");
    await linkVia(user, "goblin", /Goblin Warrior/);
    const c = within(card());
    expect(await c.findByText(/Goblin Warrior/)).toBeInTheDocument();
    await user.click(c.getByRole("button", { name: /show stat block/i }));
    expect(await c.findByRole("article", { name: /Stat Block/ })).toBeInTheDocument();
    await user.click(c.getByRole("button", { name: /unlink stat block/i }));
    expect(c.queryByText(/Goblin Warrior/)).not.toBeInTheDocument();
    expect(c.getByRole("button", { name: /link stat block/i })).toBeInTheDocument();
    expect((await listNpcs((await getDb().then((d) => d.getAll("campaigns")))[0].id))[0].statBlockId).toBeUndefined();
  });

  it("keeps the link when the NPC is edited", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPrep(user);
    await newNpc(user, "Elda");
    await linkVia(user, "owlbear", /Owlbear/);
    await within(card()).findByText(/Owlbear/);
    await user.click(within(card()).getByRole("button", { name: /^edit/i }));
    await user.type(within(card()).getByLabelText(/^role/i), "Guard");
    await user.click(within(card()).getByRole("button", { name: /save/i }));
    expect(await within(card()).findByText("Guard")).toBeInTheDocument();
    expect(await within(card()).findByText(/Owlbear/)).toBeInTheDocument();
  });

  it("shows a missing note when a linked custom Stat Block is deleted, leaving the NPC intact", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPrep(user);
    const p = await screen.findByRole("region", { name: "Custom Entries" });
    await user.click(within(p).getByRole("button", { name: "New monster" }));
    const form = within(p).getByRole("form", { name: "Custom monster editor" });
    await user.clear(within(form).getByLabelText("Name", { exact: true }));
    await user.type(within(form).getByLabelText("Name", { exact: true }), "Brine Hag");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    await within(p).findByRole("button", { name: /Brine Hag/ });
    await newNpc(user, "Elda");
    await linkVia(user, "brine", /Brine Hag/);
    await within(card()).findByText(/Brine Hag/);
    await user.click(within(p).getByRole("button", { name: /Brine Hag/ }));
    await user.click(await within(p).findByRole("button", { name: /^delete/i }));
    const confirm = screen.queryByRole("dialog");
    if (confirm) await user.click(within(confirm).getByRole("button", { name: /^delete/i }));
    expect(await within(card()).findByText(/stat block missing/i)).toBeInTheDocument();
    expect(within(card()).getByRole("heading", { name: "Elda" })).toBeInTheDocument();
  });

  it("is included in export and import", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openPrep(user);
    await newNpc(user, "Elda");
    await linkVia(user, "goblin", /Goblin Warrior/);
    await within(card()).findByText(/Goblin Warrior/);
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /export/i }));
    const text = await blobs[0].text();
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await screen.findByText(/no campaigns yet/i);
    await user.upload(screen.getByLabelText(/import campaign file/i), new File([text], "c.json", { type: "application/json" }));
    await user.click(within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
    await user.keyboard("{Alt>}4{/Alt}");
    await screen.findByRole("region", { name: /^npcs$/i });
    await user.click(within(list()).getByRole("button", { name: /^Elda/ }));
    expect(await within(card()).findByText(/Goblin Warrior/)).toBeInTheDocument();
  });

  it("resolveNpcStatBlock gives the linked Stat Block under the NPC's name, or missing", async () => {
    const npc = { id: "n", campaignId: "c", name: "Elda", statBlockId: "test-goblin" };
    const r = await resolveNpcStatBlock(npc, []);
    expect(r.status).toBe("ok");
    if (r.status === "ok") { expect(r.monster.name).toBe("Elda"); expect(r.monster.hp).toBe(7); expect(r.sourceName).toBe("Goblin Warrior"); }
    expect((await resolveNpcStatBlock({ ...npc, statBlockId: "custom:gone" }, [])).status).toBe("missing");
    expect((await resolveNpcStatBlock({ ...npc, statBlockId: undefined }, [])).status).toBe("none");
  });
});
