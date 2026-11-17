import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { getDb } from "./storage/db";
import { DASHBOARD_DEFAULT } from "./modes/modes";
import { normalizeDashboard } from "./storage/dashboard";

type User = ReturnType<typeof userEvent.setup>;

let blobs: Blob[] = [];
beforeEach(() => {
  blobs = [];
  URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), "blob:test"));
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function createCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
}
async function open(user: User, name: string) {
  await user.click(within(await screen.findByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}
async function openCampaign(user: User, name: string) {
  await createCampaign(user, name);
  await open(user, name);
}
const customize = (user: User) => user.click(screen.getByRole("button", { name: /customize dashboard/i }));
const done = (user: User) => user.click(screen.getByRole("button", { name: "Done" }));
const panelIds = () => [...document.querySelectorAll(".dashboard-grid [data-panel-id]")].map((e) => e.getAttribute("data-panel-id"));
const addPanel = (user: User, title: string) => user.selectOptions(screen.getByLabelText("Add panel"), title);
const stored = async (name: string) => {
  const all = await (await getDb()).getAll("campaigns");
  return all.find((c) => c.name === name)!;
};
const DEFAULT_IDS = ["session-summary", "player-card", "pinned-notes"];

async function reopen(user: User, name: string) {
  await user.click(screen.getByRole("button", { name: /all campaigns/i }));
  await open(user, name);
}

describe("Customizable Dashboard", () => {
  it("shows the default panels and no edit controls until Customize is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    expect(panelIds()).toEqual(DEFAULT_IDS);
    expect(document.querySelector(".dashboard-grid.customizing")).toBeNull();
    expect(document.querySelector(".react-resizable-handle")).toBeNull();
    expect(screen.queryByLabelText("Add panel")).toBeNull();
    expect(screen.queryByRole("button", { name: /^remove /i })).toBeNull();
    await customize(user);
    expect(screen.getByLabelText("Add panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Session summary" })).toBeInTheDocument();
    expect(document.querySelectorAll(".react-resizable-handle")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /^move /i })).toBeNull();
    expect(screen.queryByLabelText(/^(width|height) of /i)).toBeNull();
    await done(user);
    expect(document.querySelector(".react-resizable-handle")).toBeNull();
    expect(screen.queryByLabelText("Add panel")).toBeNull();
    expect(screen.queryByRole("button", { name: /^remove /i })).toBeNull();
    expect(screen.getByRole("button", { name: /customize dashboard/i })).toBeInTheDocument();
  });

  it("adds panels not on the Dashboard, once each, at the bottom, 60 wide and 48 high", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await customize(user);
    const picker = screen.getByLabelText("Add panel");
    const options = within(picker).getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("Dice Roller");
    expect(options.filter((o) => o === "NPCs")).toHaveLength(1);
    for (const title of ["Session summary", "Player card", "Pinned notes"]) expect(options).not.toContain(title);
    await addPanel(user, "Dice Roller");
    await waitFor(() => expect(panelIds()).toEqual([...DEFAULT_IDS, "dice-roller"]));
    await waitFor(async () => expect((await stored("Alpha")).dashboard?.panels[3]).toEqual({ panelId: "dice-roller", x: 0, y: 60, w: 60, h: 48 }));
    expect(within(screen.getByLabelText("Add panel")).queryByRole("option", { name: "Dice Roller" })).toBeNull();
    await addPanel(user, "NPCs");
    await waitFor(() => expect(panelIds()).toContain("npc-list"));
    expect(panelIds()).not.toContain("social-npc-list");
  });

  it("removes a panel, offers it again in the picker, and shows a hint when empty", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await customize(user);
    await user.click(screen.getByRole("button", { name: "Remove Pinned notes" }));
    await waitFor(() => expect(panelIds()).toEqual(["session-summary", "player-card"]));
    expect(within(screen.getByLabelText("Add panel")).getByRole("option", { name: "Pinned notes" })).toBeInTheDocument();
    expect(screen.queryByText(/your dashboard is empty/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove Session summary" }));
    await user.click(screen.getByRole("button", { name: "Remove Player card" }));
    await waitFor(() => expect(panelIds()).toEqual([]));
    expect(screen.getByText(/your dashboard is empty/i)).toBeInTheDocument();
  });

  it("resets to the default and clears the stored field", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await customize(user);
    await user.click(screen.getByRole("button", { name: "Remove Pinned notes" }));
    await waitFor(async () => expect((await stored("Alpha")).dashboard?.panels).toHaveLength(2));
    await user.click(screen.getByRole("button", { name: /reset to default/i }));
    await waitFor(() => expect(panelIds()).toEqual(DEFAULT_IDS));
    expect(await stored("Alpha")).not.toHaveProperty("dashboard");
  });

  it("keeps the arrangement across a reload, per Campaign, and gives an old Campaign the default", async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    await createCampaign(user, "Alpha");
    await createCampaign(user, "Beta");
    await open(user, "Alpha");
    await customize(user);
    await addPanel(user, "Dice Roller");
    await user.click(screen.getByRole("button", { name: "Remove Session summary" }));
    const expected = ["player-card", "pinned-notes", "dice-roller"];
    await waitFor(() => expect(panelIds()).toEqual(expected));
    await waitFor(async () => expect((await stored("Alpha")).dashboard?.panels.map((e) => e.panelId)).toEqual(expected));
    const saved = (await stored("Alpha")).dashboard;

    view.unmount();
    render(<App />);
    await open(user, "Alpha");
    await waitFor(() => expect(panelIds()).toEqual(expected));
    expect((await stored("Alpha")).dashboard).toEqual(saved);

    await reopen(user, "Beta");
    await waitFor(() => expect(panelIds()).toEqual(DEFAULT_IDS));
    expect(await stored("Beta")).not.toHaveProperty("dashboard");
  });

  it("round-trips the Dashboard through export and import, and duplicate", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await customize(user);
    await addPanel(user, "Dice Roller");
    await user.click(screen.getByRole("button", { name: "Remove Pinned notes" }));
    await waitFor(async () => expect((await stored("Alpha")).dashboard?.panels).toHaveLength(3));
    const entries = (await stored("Alpha")).dashboard;
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));

    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: "Duplicate" }));
    await screen.findByText("Alpha (copy)");
    expect((await stored("Alpha (copy)")).dashboard).toEqual(entries);

    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /export/i }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const text = await blobs[0].text();
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "Alpha" })).toBeNull());
    await user.upload(screen.getByLabelText(/import campaign file/i), new File([text], "c.json", { type: "application/json" }));
    await screen.findByText("Alpha");
    expect((await stored("Alpha")).dashboard).toEqual(entries);
    await open(user, "Alpha");
    await waitFor(() => expect(panelIds()).toEqual(["session-summary", "player-card", "dice-roller"]));
  });

  it("normalises unknown ids, duplicate ids and bad values from an imported file", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Alpha");
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /export/i }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    const doc = JSON.parse(await blobs[0].text());
    doc.campaign.dashboard =
      { grid: "fine", panels: [
        { panelId: "dice-roller", x: -4, y: 0, w: 999, h: 1 },
        { panelId: "no-such-panel", x: 0, y: 0, w: 60, h: 60 },
        { panelId: "dice-roller", x: 0, y: 0, w: 60, h: 60 },
        { panelId: 7, x: 0, y: 0, w: 60, h: 60 },
        "junk",
        { panelId: "scenes", x: 20, y: 0, w: 40, h: 60 },
      ] };
    await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "Alpha" })).toBeNull());
    await user.upload(screen.getByLabelText(/import campaign file/i), new File([JSON.stringify(doc)], "c.json", { type: "application/json" }));
    await screen.findByText("Alpha");
    await open(user, "Alpha");
    await waitFor(() => expect(panelIds()).toEqual(["dice-roller", "scenes"]));
    // Stored repaired (clamped, repeats and junk gone); the unknown id is dropped when read.
    const repaired = (await stored("Alpha")).dashboard!;
    expect(repaired.grid).toBe("fine");
    expect(repaired.panels.map((d) => d.panelId)).toEqual(["dice-roller", "no-such-panel", "scenes"]);
    expect(repaired.panels[0]).toEqual({ panelId: "dice-roller", x: 0, y: 0, w: 120, h: 24 });
  });

  it("keeps Esc and Alt+number shortcuts working while customizing", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await customize(user);
    await user.keyboard("{Alt>}1{/Alt}");
    expect(await screen.findByRole("heading", { name: /^combat$/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: /^dashboard$/i })).toBeInTheDocument();
    // Leaving the Dashboard ends customizing.
    expect(screen.getByRole("button", { name: /customize dashboard/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Add panel")).not.toBeInTheDocument();
  });

  it("does not offer Stat Blocks as a Dashboard panel (it is a navbar overlay)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await customize(user);
    expect(within(screen.getByLabelText("Add panel")).queryByRole("option", { name: "Stat Blocks" })).toBeNull();
  });
});

describe("Dashboard migration in the app", () => {
  it("opens a revision 1 arrangement as the same layout and rewrites it as grid positions", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Alpha");
    const db = await getDb();
    const rec = (await db.getAll("campaigns"))[0];
    await db.put("campaigns", { ...rec, dashboard: [
      { panelId: "scenes", width: "half", height: "tall" },
      { panelId: "dice-roller", width: "half", height: "normal" },
    ] } as never);
    await open(user, "Alpha");
    await waitFor(() => expect(panelIds()).toEqual(["scenes", "dice-roller"]));
    await customize(user);
    await user.click(screen.getByRole("button", { name: "Remove Dice Roller" }));
    await waitFor(async () => expect((await stored("Alpha")).dashboard).toEqual({ grid: "fine", panels: [{ panelId: "scenes", x: 0, y: 0, w: 60, h: 60 }] }));
  });

  it("opens a revision 2 arrangement (12 columns, 40 px rows) scaled to the fine grid", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Alpha");
    const db = await getDb();
    const rec = (await db.getAll("campaigns"))[0];
    await db.put("campaigns", { ...rec, dashboard: [
      { panelId: "scenes", x: 0, y: 0, w: 6, h: 10 },
      { panelId: "dice-roller", x: 6, y: 0, w: 6, h: 5 },
    ] } as never);
    await open(user, "Alpha");
    await waitFor(() => expect(panelIds()).toEqual(["scenes", "dice-roller"]));
    await customize(user);
    await user.click(screen.getByRole("button", { name: "Remove Scenes" }));
    await waitFor(async () => expect((await stored("Alpha")).dashboard).toEqual({ grid: "fine", panels: [{ panelId: "dice-roller", x: 60, y: 0, w: 60, h: 30 }] }));
  });
});

describe("normalizeDashboard", () => {
  const e = (panelId: string, x: number, y: number, w: number, h: number) => ({ panelId, x, y, w, h });
  const norm = (raw: unknown, known?: (id: string) => boolean) => normalizeDashboard(raw, known)?.panels;
  const fine = (...panels: unknown[]) => ({ grid: "fine", panels });

  it("keeps a valid arrangement as it is, in the fine-grid stored shape", () => {
    expect(normalizeDashboard(fine(...DASHBOARD_DEFAULT))).toEqual({ grid: "fine", panels: DASHBOARD_DEFAULT });
  });

  it("rejects non-lists and drops junk, repeats and (when asked) unknown ids", () => {
    expect(normalizeDashboard(undefined)).toBeUndefined();
    expect(normalizeDashboard({})).toBeUndefined();
    expect(norm(fine(null, "x", e("", 0, 0, 40, 40), e("a", 0, 0, 40, 40), e("a", 60, 0, 40, 40), e("b", 60, 0, 40, 40)), (id) => id !== "b"))
      .toEqual([e("a", 0, 0, 40, 40)]);
  });

  it("rounds, clamps into 120 columns and enforces the minimum size", () => {
    expect(norm(fine(e("a", -3, -2, 999, 1)))).toEqual([e("a", 0, 0, 120, 24)]);
    expect(norm(fine(e("a", 110, 0, 50, 60)))).toEqual([e("a", 70, 0, 50, 60)]);
    expect(norm(fine(e("a", 1.4, 0.6, 30.6, 24.4)))).toEqual([e("a", 1, 1, 31, 24)]);
    expect(norm(fine({ panelId: "a", x: 0, y: 0, w: "wide", h: NaN }))).toEqual([e("a", 0, 0, 60, 48)]);
  });

  it("keeps gaps: nothing floats up", () => {
    expect(norm(fine(e("a", 0, 0, 60, 30), e("b", 0, 200, 60, 30), e("c", 70, 90, 40, 30)))).toEqual([
      e("a", 0, 0, 60, 30), e("c", 70, 90, 40, 30), e("b", 0, 200, 60, 30),
    ]);
  });

  it("resolves overlaps by pushing the later panel down just below what it hits", () => {
    expect(norm(fine(e("a", 0, 0, 60, 36), e("b", 30, 12, 60, 24), e("c", 0, 240, 40, 24))))
      .toEqual([e("a", 0, 0, 60, 36), e("b", 30, 36, 60, 24), e("c", 0, 240, 40, 24)]);
  });

  it("scales a revision 2 list (12 columns, 40 px rows): x and w by 10, y and h by 6", () => {
    expect(norm([e("a", 0, 0, 6, 10), e("b", 6, 0, 6, 5), e("c", 6, 5, 6, 5)]))
      .toEqual([e("a", 0, 0, 60, 60), e("b", 60, 0, 60, 30), e("c", 60, 30, 60, 30)]);
    expect(norm([e("a", 1, 2, 3, 4)])).toEqual([e("a", 10, 12, 30, 24)]);
  });

  it("converts revision 1 entries by packing them in order, then scaling", () => {
    expect(norm([
      { panelId: "a", width: "half", height: "tall" },
      { panelId: "b", width: "half", height: "normal" },
      { panelId: "c", width: "half", height: "normal" },
    ])).toEqual([e("a", 0, 0, 60, 60), e("b", 60, 0, 60, 30), e("c", 60, 30, 60, 30)]);
    expect(norm([
      { panelId: "a", width: "third", height: "normal" },
      { panelId: "b", width: "full", height: "normal" },
      { panelId: "c", width: "two-thirds", height: "tall" },
      { panelId: "d", width: "weird", height: "weird" },
    ])).toEqual([e("a", 0, 0, 40, 30), e("d", 40, 0, 60, 30), e("b", 0, 30, 120, 30), e("c", 0, 60, 80, 60)]);
  });
});
