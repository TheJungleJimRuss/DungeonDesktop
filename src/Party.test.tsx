import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App";

type User = ReturnType<typeof userEvent.setup>;

let blobs: Blob[] = [];
beforeEach(() => {
  blobs = [];
  URL.createObjectURL = vi.fn((b: Blob) => (blobs.push(b), "blob:test"));
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function openCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await openExisting(user, name);
}
async function openExisting(user: User, name: string) {
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: "Dashboard" });
}
const party = () => screen.getByRole("region", { name: /party/i });

async function addMember(user: User, f: { name: string; cls: string; level: string; ac: string; hp: string; pp: string; notes?: string }) {
  await user.click(within(party()).getByRole("button", { name: /add member/i }));
  const p = within(party());
  await user.type(p.getByLabelText("Name"), f.name);
  await user.type(p.getByLabelText("Class"), f.cls);
  for (const [label, val] of [["Level", f.level], ["AC", f.ac], ["Max HP", f.hp], ["Passive Perception", f.pp]]) {
    await user.clear(p.getByLabelText(label));
    await user.type(p.getByLabelText(label), val);
  }
  if (f.notes) await user.type(p.getByLabelText("Notes"), f.notes);
  await user.click(p.getByRole("button", { name: /save member/i }));
}
const ARIN = { name: "Arin", cls: "Rogue", level: "3", ac: "15", hp: "24", pp: "14", notes: "Owes the guild" };

describe("Party sheet", () => {
  it("adds a member and shows AC, HP and passive Perception on the Dashboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Strahd");
    expect(within(party()).getByText(/no party members/i)).toBeInTheDocument();
    await addMember(user, ARIN);
    const row = await within(party()).findByRole("listitem", { name: "Arin" });
    expect(row).toHaveTextContent("Rogue 3");
    expect(row).toHaveTextContent("AC 15");
    expect(row).toHaveTextContent("HP 24");
    expect(row).toHaveTextContent("PP 14");
    expect(row).toHaveTextContent("Owes the guild");
  });

  it("edits a member, including leveling up", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Strahd");
    await addMember(user, ARIN);
    await user.click(await within(party()).findByRole("button", { name: /edit arin/i }));
    const level = within(party()).getByLabelText("Level");
    await user.clear(level);
    await user.type(level, "4");
    await user.click(within(party()).getByRole("button", { name: /save member/i }));
    expect(await within(party()).findByRole("listitem", { name: "Arin" })).toHaveTextContent("Rogue 4");
  });

  it("removes a member", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Strahd");
    await addMember(user, ARIN);
    await user.click(await within(party()).findByRole("button", { name: /remove arin/i }));
    expect(await within(party()).findByText(/no party members/i)).toBeInTheDocument();
    expect(within(party()).queryByText("Arin")).not.toBeInTheDocument();
  });

  it("keeps the Party per Campaign and across reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await openCampaign(user, "Alpha");
    await addMember(user, ARIN);
    await within(party()).findByText("Arin");
    first.unmount();

    render(<App />);
    await openExisting(user, "Alpha");
    expect(await within(party()).findByText("Arin")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Beta");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await openExisting(user, "Beta");
    expect(await within(party()).findByText(/no party members/i)).toBeInTheDocument();
  });

  it("includes the Party in export and restores it on import", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Portable");
    await addMember(user, ARIN);
    await within(party()).findByText("Arin");
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    const item = await screen.findByRole("listitem", { name: "Portable" });
    await user.click(within(item).getByRole("button", { name: /export/i }));
    const text = await blobs[0].text();
    expect(text).toContain("Arin");

    await user.click(within(item).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await screen.findByText(/no campaigns yet/i);
    await user.upload(screen.getByLabelText(/import campaign file/i), new File([text], "c.json", { type: "application/json" }));
    await openExisting(user, "Portable");
    const row = await within(party()).findByRole("listitem", { name: "Arin" });
    expect(row).toHaveTextContent("AC 15");
  });
});
