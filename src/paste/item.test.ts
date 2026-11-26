import { readItem } from "./item";

describe("readItem", () => {
  it("reads attunement with a class", () => {
    const r = readItem(`Lantern of Quiet Hours
Wondrous Item, Rare (Requires Attunement by a Wizard)
While lit, the lantern sheds dim light in a 30-foot radius.

Once per dawn you can snuff it as a Magic action.`);
    expect(r.name).toBe("Lantern of Quiet Hours");
    expect(r.fields).toEqual({
      type: "Wondrous Item", rarity: "Rare", attunement: "Requires Attunement by a Wizard",
      desc: "While lit, the lantern sheds dim light in a 30-foot radius.\n\nOnce per dawn you can snuff it as a Magic action.",
    });
    expect(r.unread).toEqual([]);
  });

  it("reads attunement without a class", () => {
    const r = readItem("Hollow Bell\nWondrous Item, Uncommon (Requires Attunement)\nIt rings once.");
    expect(r.fields).toMatchObject({ type: "Wondrous Item", rarity: "Uncommon", attunement: "Requires Attunement" });
  });

  it("leaves attunement empty when there is none", () => {
    const r = readItem("Pebble of Calm\nWondrous Item, Common\nIt is warm.");
    expect(r.fields.attunement).toBe("");
    expect(r.fields.rarity).toBe("Common");
  });

  it("reads multi-word rarities and keeps the source capitalisation", () => {
    expect(readItem("Ash Blade\nWeapon (Longsword), Very Rare (Requires Attunement)\nHot.").fields).toMatchObject({ type: "Weapon (Longsword)", rarity: "Very Rare", attunement: "Requires Attunement" });
    expect(readItem("Wandering Cloak\nWondrous Item, Rarity Varies\nIt shifts.").fields.rarity).toBe("Rarity Varies");
    expect(readItem("Crown of Ages\nWondrous Item, Artifact\nOld.").fields.rarity).toBe("Artifact");
  });

  it("keeps the parenthetical type detail", () => {
    const r = readItem("Moss Plate\nArmor (Any Medium or Heavy), Uncommon\nGreen.");
    expect(r.fields.type).toBe("Armor (Any Medium or Heavy)");
    expect(r.fields.rarity).toBe("Uncommon");
    expect(readItem("Band of Echoes\nRing, Legendary\nLoud.").fields.type).toBe("Ring");
  });

  it("joins Live Text line breaks into paragraphs", () => {
    const r = readItem(`Hollow Bell
Wondrous Item, Rare
It rings once when
a creature lies within
60 feet.

Second paragraph.`);
    expect(r.fields.desc).toBe("It rings once when a creature lies within 60 feet.\n\nSecond paragraph.");
  });

  it("puts an unparsed header in unread and keeps the rest as description", () => {
    const r = readItem("Hollow Bell\nSome odd header line\nIt rings once.");
    expect(r.unread).toEqual(["Some odd header line"]);
    expect(r.fields).toEqual({ desc: "It rings once." });
    expect(r.name).toBe("Hollow Bell");
  });

  it("reads nothing from a single unreadable line", () => {
    const r = readItem("hello there");
    expect(r.name).toBeUndefined();
    expect(r.fields).toEqual({});
  });

  it("joins a wrapped header line", () => {
    const r = readItem("Hollow Bell\nWondrous Item, Very\nRare (Requires Attunement)\nIt rings once.");
    expect(r.fields).toMatchObject({ type: "Wondrous Item", rarity: "Very Rare", attunement: "Requires Attunement" });
    expect(r.name).toBe("Hollow Bell");
  });

  it("has no name when the first line is the header", () => {
    const r = readItem("Wondrous Item, Rare\nThis cloak grants a faint glow.");
    expect(r.name).toBeUndefined();
    expect(r.fields).toMatchObject({ type: "Wondrous Item", rarity: "Rare", desc: "This cloak grants a faint glow." });
    expect(r.unread).toEqual([]);
  });
});
