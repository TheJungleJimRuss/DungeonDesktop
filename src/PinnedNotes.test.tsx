import { render, screen, waitFor, within } from "@testing-library/react";
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

async function createCampaign(user: User, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
}
async function openCampaign(user: User, name: string) {
  await user.click(within(await screen.findByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}
const panel = () => screen.getByRole("region", { name: /pinned notes/i });
async function addNote(user: User, text: string) {
  await user.type(within(panel()).getByRole("textbox", { name: /new pinned note/i }), text);
  await user.click(within(panel()).getByRole("button", { name: /add note/i }));
  await within(panel()).findByText(text);
}
const texts = () => within(panel()).queryAllByRole("listitem").map((li) => li.querySelector("[data-note-text]")?.textContent);

describe("Pinned notes", () => {
  it("adds notes to the Dashboard in order", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "A");
    await openCampaign(user, "A");
    await addNote(user, "Strahd hates sunlight");
    await addNote(user, "Barovia fog");
    expect(texts()).toEqual(["Strahd hates sunlight", "Barovia fog"]);
    expect(within(panel()).getByRole("textbox", { name: /new pinned note/i })).toHaveValue("");
  });

  it("edits a note", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "A");
    await openCampaign(user, "A");
    await addNote(user, "Old text");
    await user.click(within(panel()).getByRole("button", { name: /edit note: old text/i }));
    const input = within(panel()).getByRole("textbox", { name: /edit note/i });
    await user.clear(input);
    await user.type(input, "New text");
    await user.click(within(panel()).getByRole("button", { name: /save note/i }));
    await within(panel()).findByText("New text");
    expect(texts()).toEqual(["New text"]);
  });

  it("reorders with move up and down, and disables the ends", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "A");
    await openCampaign(user, "A");
    for (const t of ["one", "two", "three"]) await addNote(user, t);
    expect(within(panel()).getByRole("button", { name: /move up: one/i })).toBeDisabled();
    expect(within(panel()).getByRole("button", { name: /move down: three/i })).toBeDisabled();
    await user.click(within(panel()).getByRole("button", { name: /move up: three/i }));
    await waitFor(() => expect(texts()).toEqual(["one", "three", "two"]));
    await user.click(within(panel()).getByRole("button", { name: /move down: one/i }));
    await waitFor(() => expect(texts()).toEqual(["three", "one", "two"]));
  });

  it("removes a note", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "A");
    await openCampaign(user, "A");
    await addNote(user, "keep");
    await addNote(user, "drop");
    await user.click(within(panel()).getByRole("button", { name: /remove note: drop/i }));
    expect(texts()).toEqual(["keep"]);
  });

  it("persists order across reload and keeps Campaigns separate", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await createCampaign(user, "A");
    await createCampaign(user, "B");
    await openCampaign(user, "A");
    await addNote(user, "a1");
    await addNote(user, "a2");
    await user.click(within(panel()).getByRole("button", { name: /move up: a2/i }));
    first.unmount();

    render(<App />);
    await openCampaign(user, "A");
    await within(panel()).findByText("a1");
    expect(texts()).toEqual(["a2", "a1"]);
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await openCampaign(user, "B");
    expect(within(panel()).getByText(/no pinned notes/i)).toBeInTheDocument();
  });

  it("survives export, delete and import", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Exported");
    await openCampaign(user, "Exported");
    await addNote(user, "remember this");
    await addNote(user, "and this");
    await user.click(within(panel()).getByRole("button", { name: /move up: and this/i }));
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Exported" })).getByRole("button", { name: /export/i }));
    const text = await blobs[0].text();
    await user.click(within(screen.getByRole("listitem", { name: "Exported" })).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    await screen.findByText(/no campaigns yet/i);
    await user.upload(screen.getByLabelText(/import campaign file/i), new File([text], "c.json", { type: "application/json" }));
    await screen.findByText("Exported");
    await openCampaign(user, "Exported");
    await within(panel()).findByText("remember this");
    expect(texts()).toEqual(["and this", "remember this"]);
  });
});
