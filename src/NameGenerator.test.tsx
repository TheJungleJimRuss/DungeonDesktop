import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { listCampaigns } from "./storage";
import { listNpcs } from "./storage/npcs";

type User = ReturnType<typeof userEvent.setup>;
async function openCampaign(user: User) {
  await user.type(await screen.findByRole("textbox", { name: /new campaign name/i }), "Alpha");
  await user.click(screen.getByRole("button", { name: /create campaign/i }));
  await screen.findByText("Alpha");
  await user.click(within(screen.getByRole("listitem", { name: "Alpha" })).getByRole("button", { name: /open/i }));
  await screen.findByRole("heading", { name: /dashboard/i });
  return (await listCampaigns())[0].id;
}
beforeEach(() => localStorage.clear());

const card = () => screen.getByRole("region", { name: /npc card/i });
const suggestions = () => within(card()).getAllByRole("button", { name: /^use name /i }).map((b) => b.textContent!);

async function newNpcInSocial(user: User) {
  await user.keyboard("{Alt>}3{/Alt}");
  await user.click(await screen.findByRole("button", { name: /new npc/i }));
  return within(card());
}

describe("Name suggestions in the NPC card", () => {
  it("is no longer a separate panel in Social mode", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    await user.keyboard("{Alt>}3{/Alt}");
    await screen.findByRole("region", { name: /npc card/i });
    expect(screen.queryByRole("region", { name: "Name Generator" })).toBeNull();
  });

  it("stays hidden until asked for, and can be hidden again", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    const c = await newNpcInSocial(user);
    expect(c.queryByRole("region", { name: /name suggestions/i })).toBeNull();
    await user.click(c.getByRole("button", { name: /suggest names/i }));
    expect(suggestions().length).toBeGreaterThanOrEqual(5);
    await user.click(c.getByRole("button", { name: /^hide$/i }));
    expect(c.queryByRole("region", { name: /name suggestions/i })).toBeNull();
  });

  it("rerolls and respects the style", async () => {
    const user = userEvent.setup();
    render(<App />);
    await openCampaign(user);
    const c = await newNpcInSocial(user);
    await user.click(c.getByRole("button", { name: /suggest names/i }));
    const first = suggestions();
    await user.click(c.getByRole("button", { name: /reroll/i }));
    expect(suggestions()).not.toEqual(first);
    await user.selectOptions(c.getByRole("combobox", { name: /name style/i }), "dwarven");
    expect(suggestions().length).toBeGreaterThanOrEqual(5);
  });

  it("fills the Name field with the picked name, and the NPC saves with it", async () => {
    const user = userEvent.setup();
    render(<App />);
    const id = await openCampaign(user);
    const c = await newNpcInSocial(user);
    await user.click(c.getByRole("button", { name: /suggest names/i }));
    const [first] = suggestions();
    await user.click(c.getByRole("button", { name: `Use name ${first}` }));
    expect(c.getByLabelText(/^name/i)).toHaveValue(first);
    expect(c.queryByRole("region", { name: /name suggestions/i })).toBeNull();
    await user.click(c.getByRole("button", { name: /save/i }));
    expect(await c.findByRole("heading", { name: first })).toBeInTheDocument();
    expect((await listNpcs(id)).map((n) => n.name)).toEqual([first]);
  });
});
