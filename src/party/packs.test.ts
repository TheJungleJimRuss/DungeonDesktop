import { newEquipmentEntry, parsePackItem } from "./sheet";

const SRD = [
  { name: "Explorer's Pack", contents: ["Backpack", "Rations (10)", "Torch (10)", "Rope"] },
  { name: "Rope" },
];

describe("adding SRD packs", () => {
  it("reads counts in brackets", () => {
    expect(parsePackItem("Rations (10)")).toEqual({ name: "Rations", quantity: 10 });
    expect(parsePackItem("Rope")).toEqual({ name: "Rope" });
    expect(parsePackItem("Candle (1)")).toEqual({ name: "Candle" });
  });
  it("turns an SRD pack name into a filled pack, whatever the case", () => {
    expect(newEquipmentEntry("explorer's pack", 1, SRD)).toEqual({
      name: "Explorer's Pack",
      contents: [{ name: "Backpack" }, { name: "Rations", quantity: 10 }, { name: "Torch", quantity: 10 }, { name: "Rope" }],
    });
    expect(newEquipmentEntry("Explorer's Pack", 2, SRD, true).quantity).toBe(2);
  });
  it("keeps other names as plain items or empty packs", () => {
    expect(newEquipmentEntry("rope", 3, SRD)).toEqual({ name: "Rope", quantity: 3 });
    expect(newEquipmentEntry(" Sack ", 1, SRD)).toEqual({ name: "Sack" });
    expect(newEquipmentEntry("Sack", 1, SRD, true)).toEqual({ name: "Sack", contents: [] });
    expect(newEquipmentEntry("Explorer's Pack", 1, undefined)).toEqual({ name: "Explorer's Pack" });
  });
});
