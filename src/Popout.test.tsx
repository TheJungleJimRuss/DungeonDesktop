import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";
import { listCampaigns } from "./storage";
import { addPartyMember } from "./storage/party";
import { getPoppedPanels } from "./popout/popoutState";

type User = ReturnType<typeof userEvent.setup>;
interface FakeWindow { closed: boolean; close(): void; focus(): void }
let opened: FakeWindow[];
let openSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  opened = [];
  openSpy = vi.fn(() => {
    const w: FakeWindow = { closed: false, close() { this.closed = true; }, focus() {} };
    opened.push(w);
    return w;
  });
  vi.stubGlobal("open", openSpy);
});
afterEach(() => vi.unstubAllGlobals());

async function openCampaign(user: User, name = "Test Camp") {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: "Dashboard" });
}
const partyRegion = () => screen.queryByRole("region", { name: /party/i });

describe("Pop-out Window", () => {
  it("pops a panel out, leaves a placeholder, and brings it back", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    await user.click(screen.getByRole("button", { name: /pop out party/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(String(openSpy.mock.calls[0][0])).toMatch(/\?popout=/);
    expect(partyRegion()).toBeNull();
    expect(screen.getByRole("region", { name: /pinned notes/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /popped out — bring back/i }));
    expect(partyRegion()).toBeInTheDocument();
    expect(opened[0].closed).toBe(true); // last panel returned: window closes
  });

  it("returns the panels when the Pop-out Window is closed", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    await user.click(screen.getByRole("button", { name: /pop out party/i }));
    expect(partyRegion()).toBeNull();
    opened[0].closed = true; // the DM closes the window
    expect(await screen.findByRole("region", { name: /party/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reopen pop-out/i })).toBeNull();
  });

  it("remembers popped-out panels per Campaign and offers to reopen the window", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await openCampaign(user);
    await user.click(screen.getByRole("button", { name: /pop out party/i }));
    first.unmount(); // main window goes away; the pop-out is not closed by the DM

    render(<App />);
    await screen.findByText("Test Camp");
    await user.click(screen.getByRole("button", { name: /open/i }));
    await screen.findByRole("heading", { name: "Dashboard" });
    expect(partyRegion()).toBeNull();
    openSpy.mockClear();
    await user.click(screen.getByRole("button", { name: /reopen pop-out/i }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /reopen pop-out/i })).toBeNull();
  });

  it("does not remember panels for a different Campaign", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "One");
    await user.click(screen.getByRole("button", { name: /pop out party/i }));
    const [camp] = await listCampaigns();
    expect(getPoppedPanels(camp.id)).toEqual(["party-glance"]);
    expect(getPoppedPanels("other")).toEqual([]);
  });

  it("shows a blocked-popup message and keeps the panel when window.open fails", async () => {
    const user = userEvent.setup();
    openSpy.mockReturnValue(null);
    render(<App />);
    await openCampaign(user);
    await user.click(screen.getByRole("button", { name: /pop out party/i }));
    expect(partyRegion()).toBeInTheDocument();
    expect(await screen.findByText(/blocked the pop-out/i)).toBeInTheDocument();
  });

  it("renders only the popped panels in the pop-out route and can send one back", async () => {
    const user = userEvent.setup();
    const main = render(<App />);
    await openCampaign(user);
    await user.click(screen.getByRole("button", { name: /pop out party/i }));
    await user.click(screen.getByRole("button", { name: /pop out pinned notes/i }));
    const [camp] = await listCampaigns();

    const pop = render(<App search={`?popout=${camp.id}`} />);
    const win = within(pop.container);
    await win.findByRole("region", { name: /party/i });
    expect(win.getByRole("region", { name: /pinned notes/i })).toBeInTheDocument();
    expect(win.queryByRole("navigation")).toBeNull();

    await user.click(win.getByRole("button", { name: /bring back party/i }));
    await waitFor(() => expect(win.queryByRole("region", { name: /party/i })).toBeNull());
    expect(win.getByRole("region", { name: /pinned notes/i })).toBeInTheDocument();
    // main window sees it come back
    expect(within(main.container).getByRole("region", { name: /party/i })).toBeInTheDocument();
  });

  it("shows data written elsewhere without a reload", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    const [camp] = await listCampaigns();
    expect(await screen.findByText(/no party members yet/i)).toBeInTheDocument();
    await addPartyMember(camp.id, { name: "Thia", class: "Rogue", level: 3, ac: 14, maxHp: 20, passivePerception: 12, notes: "" }); // "other window"
    expect(await screen.findByText("Thia")).toBeInTheDocument();
  });
});
