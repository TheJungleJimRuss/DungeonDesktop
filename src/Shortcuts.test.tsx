import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { registerShortcut } from "./shortcuts/shortcuts";

async function openCampaign(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), name);
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText(name);
  await user.click(within(screen.getByRole("listitem", { name })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
}

describe("central shortcut layer", () => {
  it("rejects a conflicting registration with a message naming the owner", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    expect(() => registerShortcut({ combo: "alt+1", label: "Clash", handler: () => {} }))
      .toThrow(/Alt\+1 is already used by "Combat"/);
    const off = registerShortcut({ combo: "Alt+9", label: "Mine", handler: () => {} });
    expect(() => registerShortcut({ combo: "Alt+9", label: "Other", handler: () => {} })).toThrow(/already used/);
    off();
    registerShortcut({ combo: "Alt+9", label: "Again", handler: () => {} })();
  });

  it("runs a panel-registered shortcut once, and not while typing or in a dialog", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const hits: string[] = [];
    const off = registerShortcut({ combo: "Alt+K", label: "Probe", handler: () => hits.push("k") });
    await user.keyboard("{Alt>}k{/Alt}");
    expect(hits).toEqual(["k"]);
    const input = document.createElement("input");
    document.body.appendChild(input);
    await user.click(input);
    await user.keyboard("{Alt>}k{/Alt}");
    expect(hits).toHaveLength(1);
    input.remove();
    const dlg = document.createElement("div");
    dlg.setAttribute("role", "dialog");
    document.body.appendChild(dlg);
    await user.keyboard("{Alt>}k{/Alt}");
    expect(hits).toHaveLength(1);
    dlg.remove();
    off();
  });

  it("runs an Alt shortcut from the bare key when not typing", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user, "Alpha");
    const hits: string[] = [];
    const off = registerShortcut({ combo: "Alt+J", label: "Probe", handler: () => hits.push("j") });
    await user.keyboard("j");
    expect(hits).toEqual(["j"]);
    const input = document.createElement("input");
    document.body.appendChild(input);
    await user.click(input);
    await user.keyboard("j");
    expect(hits).toHaveLength(1);
    expect(input.value).toBe("j");
    input.remove();
    off();
  });
});
