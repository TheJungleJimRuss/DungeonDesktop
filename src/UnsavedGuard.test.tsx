import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

async function openParty(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Guard");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Guard");
  await user.click(within(screen.getByRole("listitem", { name: "Guard" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: "Dashboard" });
  await user.click(screen.getByRole("button", { name: /^party/i }));
  const p = within(await screen.findByRole("region", { name: /character sheets/i }));
  await user.click(p.getByRole("button", { name: /add character/i }));
  return p;
}

let confirmSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { localStorage.clear(); confirmSpy = vi.spyOn(window, "confirm"); });
afterEach(() => confirmSpy.mockRestore());

describe("Unsaved edits are not discarded silently", () => {
  it("Escape with an untouched form just goes to the Dashboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openParty(user);
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("Escape with a half-filled sheet asks, and staying keeps the draft", async () => {
    confirmSpy.mockReturnValue(false);
    const user = userEvent.setup();
    render(<App />);
    const p = await openParty(user);
    await user.type(p.getByLabelText("Name"), "Dana");
    (document.activeElement as HTMLElement).blur();
    await user.keyboard("{Escape}");
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Party" })).toBeInTheDocument();
    expect(p.getByLabelText("Name")).toHaveValue("Dana");
  });

  it("switching Mode with a half-filled sheet asks, and confirming leaves", async () => {
    confirmSpy.mockReturnValue(true);
    const user = userEvent.setup();
    render(<App />);
    const p = await openParty(user);
    await user.type(p.getByLabelText("Name"), "Dana");
    await user.click(screen.getByRole("button", { name: /^prep/i }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Prep" })).toBeInTheDocument();
  });

  it("a saved sheet no longer counts as unsaved", async () => {
    const user = userEvent.setup();
    render(<App />);
    const p = await openParty(user);
    await user.type(p.getByLabelText("Name"), "Dana");
    await user.click(p.getByRole("button", { name: /save member/i }));
    await p.findByRole("button", { name: /add character/i });
    await user.click(screen.getByRole("button", { name: "All campaigns" }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: /choose a campaign/i })).toBeInTheDocument();
  });
});
