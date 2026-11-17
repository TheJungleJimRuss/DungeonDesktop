import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

async function createCampaign(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
}

function row(name: string) {
  return screen.getByRole("listitem", { name });
}

describe("Campaign picker", () => {
  it("shows a Campaign picker on launch", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /choose a campaign/i })).toBeInTheDocument();
    expect(await screen.findByText(/no campaigns yet/i)).toBeInTheDocument();
  });

  it("creates a Campaign", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Curse of Strahd");
    expect(screen.queryByText(/no campaigns yet/i)).not.toBeInTheDocument();
  });

  it("renames a Campaign", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Old Name");
    await user.click(within(row("Old Name")).getByRole("button", { name: /rename/i }));
    const input = screen.getByRole("textbox", { name: /^campaign name$/i });
    await user.clear(input);
    await user.type(input, "New Name");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText("New Name")).toBeInTheDocument();
    expect(screen.queryByText("Old Name")).not.toBeInTheDocument();
  });

  it("duplicates a Campaign", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Original");
    await user.click(within(row("Original")).getByRole("button", { name: /duplicate/i }));
    expect(await screen.findByText("Original (copy)")).toBeInTheDocument();
    expect(screen.getByText("Original")).toBeInTheDocument();
  });

  it("requires confirmation to delete, and cancel keeps the Campaign", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Doomed");
    await user.click(within(row("Doomed")).getByRole("button", { name: /delete/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/doomed/i);
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Doomed")).toBeInTheDocument();

    await user.click(within(row("Doomed")).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    expect(screen.queryByText("Doomed")).not.toBeInTheDocument();
    expect(await screen.findByText(/no campaigns yet/i)).toBeInTheDocument();
  });

  it("persists Campaigns across reload (remount)", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await createCampaign(user, "Keeper");
    await user.click(within(row("Keeper")).getByRole("button", { name: /duplicate/i }));
    await screen.findByText("Keeper (copy)");
    first.unmount();

    render(<App />);
    expect(await screen.findByText("Keeper")).toBeInTheDocument();
    expect(screen.getByText("Keeper (copy)")).toBeInTheDocument();
  });

  it("keeps deletes and renames across reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await createCampaign(user, "Gone");
    await createCampaign(user, "Stays");
    await user.click(within(row("Gone")).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    first.unmount();

    render(<App />);
    expect(await screen.findByText("Stays")).toBeInTheDocument();
    expect(screen.queryByText("Gone")).not.toBeInTheDocument();
  });

  it("opens a Campaign to an empty Dashboard and returns to the picker", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Lost Mine");
    await user.click(within(row("Lost Mine")).getByRole("button", { name: /open/i }));
    expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText("Lost Mine")).toBeInTheDocument();
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    expect(await screen.findByRole("heading", { name: /choose a campaign/i })).toBeInTheDocument();
  });

  it("isolates Campaigns: deleting one leaves the other intact", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createCampaign(user, "Alpha");
    await createCampaign(user, "Beta");
    await user.click(within(row("Alpha")).getByRole("button", { name: /rename/i }));
    const input = screen.getByRole("textbox", { name: /^campaign name$/i });
    await user.clear(input);
    await user.type(input, "Alpha 2");
    await user.click(screen.getByRole("button", { name: /save/i }));
    await screen.findByText("Alpha 2");
    expect(screen.getByText("Beta")).toBeInTheDocument();
    await user.click(within(row("Alpha 2")).getByRole("button", { name: /delete/i }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /delete campaign/i }));
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Alpha 2")).not.toBeInTheDocument();
  });
});
