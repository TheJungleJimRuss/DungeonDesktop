import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

type User = ReturnType<typeof userEvent.setup>;

async function openCampaign(user: User, name: string) {
  const input = await screen.findByRole("textbox", { name: /new campaign name/i });
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}

const modeButton = (name: RegExp) =>
  within(screen.getByRole("navigation", { name: /modes/i })).getByRole("button", { name });

describe("Dashboard and Mode switcher", () => {
  it("lands on the Dashboard with panels and five Mode buttons", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    expect(screen.getByRole("region", { name: /session summary/i })).toBeInTheDocument();
    for (const m of [/combat/i, /exploration/i, /social/i, /prep/i, /party/i]) {
      expect(modeButton(m)).toBeInTheDocument();
    }
  });

  it("switches layout when a Mode button is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.click(modeButton(/combat/i));
    expect(await screen.findByRole("heading", { name: /^combat$/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^dashboard$/i })).not.toBeInTheDocument();
    expect(modeButton(/combat/i)).toHaveAttribute("aria-current", "page");
    await user.click(modeButton(/prep/i));
    expect(await screen.findByRole("heading", { name: /^prep$/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^combat$/i })).not.toBeInTheDocument();
  });

  it("switches Mode with keyboard shortcuts and returns to the Dashboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}1{/Alt}");
    expect(await screen.findByRole("heading", { name: /^combat$/i })).toBeInTheDocument();
    await user.keyboard("{Alt>}2{/Alt}");
    expect(await screen.findByRole("heading", { name: /^exploration/i })).toBeInTheDocument();
    await user.keyboard("{Alt>}3{/Alt}");
    expect(await screen.findByRole("heading", { name: /^social/i })).toBeInTheDocument();
    await user.keyboard("{Alt>}4{/Alt}");
    expect(await screen.findByRole("heading", { name: /^prep$/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: /^dashboard$/i })).toBeInTheDocument();
  });

  it("switches Mode on bare number keys when not typing, and keeps shortcut hints off the buttons", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("1");
    expect(await screen.findByRole("heading", { level: 1, name: /^combat$/i })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(modeButton(/combat/i)).not.toHaveTextContent("Alt+1");
    expect(modeButton(/prep/i)).not.toHaveTextContent("Alt+4");
  });

  it("ignores Esc while a dialog is open", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.keyboard("{Alt>}4{/Alt}");
    await screen.findByRole("heading", { name: /^prep$/i });
    const dlg = document.createElement("div");
    dlg.setAttribute("role", "dialog");
    document.body.appendChild(dlg);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("heading", { name: /^prep$/i })).toBeInTheDocument();
    dlg.remove();
  });

  it("has a button back to the Dashboard and back to the Campaign picker", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    await user.click(modeButton(/social/i));
    await user.click(screen.getByRole("button", { name: /^dashboard/i }));
    expect(await screen.findByRole("heading", { name: /^dashboard$/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    expect(await screen.findByRole("heading", { name: /choose a campaign/i })).toBeInTheDocument();
  });

  it("ignores shortcuts while typing in a text field", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const input = document.createElement("input");
    input.setAttribute("aria-label", "scratch");
    document.body.appendChild(input);
    await user.click(input);
    await user.keyboard("1");
    await user.keyboard("{Alt>}1{/Alt}");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("heading", { name: /^dashboard$/i })).toBeInTheDocument();
    input.remove();
  });

  it("remembers the last Mode per Campaign across reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await openCampaign(user, "Alpha");
    await user.click(modeButton(/combat/i));
    await screen.findByRole("heading", { name: /^combat$/i });
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    // second Campaign with a different last Mode
    const input = await screen.findByRole("textbox", { name: /new campaign name/i });
    await user.type(input, "Beta");
    await user.click(screen.getByRole("button", { name: /create campaign/i }));
    await screen.findByText("Beta");
    await user.click(within(screen.getByRole("listitem", { name: "Beta" })).getByRole("button", { name: /open/i }));
    await user.click(await within(await screen.findByRole("navigation", { name: /modes/i })).findByRole("button", { name: /prep/i }));
    await screen.findByRole("heading", { name: /^prep$/i });
    first.unmount();

    render(<App />);
    await user.click(
      within(await screen.findByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }),
    );
    // Dashboard lands first, offering to resume the remembered Mode.
    await screen.findByRole("heading", { name: /^dashboard$/i });
    await user.click(screen.getByRole("button", { name: /continue in combat/i }));
    expect(await screen.findByRole("heading", { name: /^combat$/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /all campaigns/i }));
    await user.click(within(await screen.findByRole("listitem", { name: "Beta" })).getByRole("button", { name: /open/i }));
    expect(await screen.findByRole("button", { name: /continue in prep/i })).toBeInTheDocument();
  });

  it("gives every panel a stable id so it can be popped out later", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const ids = [...document.querySelectorAll("[data-panel-id]")].map((e) => e.getAttribute("data-panel-id"));
    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z][a-z0-9-]*$/.test(id!))).toBe(true);
  });
});
