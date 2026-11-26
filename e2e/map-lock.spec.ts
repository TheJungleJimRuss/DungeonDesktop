import { expect, test } from "@playwright/test";
import { editStoredMap, gridAt, openMap, reopenMap, setStoredView, storedMap, type View } from "./map-helpers";

const VIEW: View = { cx: 5, cy: 5, px: 32 };
const sq = (x: number, y: number, s: number) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const area = (id: string, x: number, s: number, name: string, locked?: true) =>
  ({ id, closed: true, points: sq(x, x, s), segments: ["plain", "plain", "plain", "plain"], area: { kind: "Area", color: "#3366ff", name, ...(locked ? { locked } : {}) } });

test("a locked Area lets single clicks through to what is inside it; a double-click selects it", async ({ page }) => {
  await openMap(page, "Lock Camp");
  await editStoredMap(page, { lines: [area("land", 0, 10, "Land", true), area("hut", 6, 2, "Hut")] });
  await setStoredView(page, (await storedMap(page)).id, VIEW);
  const map = await reopenMap(page, "Lock Camp");
  const at = await gridAt(map, VIEW);
  const editor = map.getByRole("group", { name: /^Area of / });
  await page.mouse.click(...at(2, 2)); // the locked Land only
  await expect(editor).toHaveCount(0);
  await page.mouse.click(...at(7, 7)); // the Hut inside it
  await expect(editor).toHaveAttribute("aria-label", /Hut|Shape 2/);
  await page.mouse.click(...at(2, 2)); // a click on the locked Land acts as empty Map
  await expect(editor).toHaveCount(0);
  await page.mouse.dblclick(...at(2, 2));
  await expect(editor).toHaveAttribute("aria-label", /Land|Shape 1/);
  await expect(map.getByRole("checkbox", { name: "Area locked" })).toBeChecked();
  await page.mouse.dblclick(...at(0, 5)); // its outline too
  await expect(editor).toHaveAttribute("aria-label", /Land|Shape 1/);
});
