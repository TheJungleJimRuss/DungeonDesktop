import type { Monster } from "./monsters";

/** Small fixture dataset for tests: not real SRD content, just the shapes the app must handle. */
const base: Omit<Monster, "id" | "name"> = {
  size: "Medium", type: "humanoid", alignment: "neutral evil", ac: 15, hp: 7, hpRoll: "2d6", speed: "30 ft.",
  abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, saves: [], skills: ["Stealth +6"],
  vulnerabilities: [], resistances: [], immunities: [], conditionImmunities: [], senses: "Darkvision 60 ft., Passive Perception 9",
  languages: "Common", cr: 0.25, xp: 50, pb: 2, traits: [], actions: [{ name: "Scimitar", desc: "Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage." }],
  bonusActions: [], reactions: [], legendaryActions: [],
};

export const FIXTURE_MONSTERS: Monster[] = [
  { ...base, id: "test-goblin", name: "Goblin Warrior", acNote: "leather armor", traits: [{ name: "Nimble Escape", desc: "Disengage or Hide as a Bonus Action." }] },
  { ...base, id: "test-wyrm", name: "Ancient Test Wyrm", size: "Gargantuan", type: "dragon", cr: 22, xp: 41000, xpInLair: 50000, pb: 7, hp: 546, hpRoll: "28d20 + 252",
    legendaryUses: 3, legendaryActions: [{ name: "Tail Swipe", desc: "The wyrm makes one Tail attack." }],
    lairActions: [{ name: "Tremor", desc: "The ground shakes." }], reactions: [{ name: "Scale Shield", desc: "Reduces damage." }], bonusActions: [{ name: "Hiss", desc: "A loud hiss." }] },
  { ...base, id: "test-wisp", name: "Will-o’-Wisp", type: "undead", cr: 2, xp: 450 },
  { ...base, id: "test-skeleton", name: "Skeleton", type: "undead", cr: 0.25 },
  { ...base, id: "test-owlbear", name: "Owlbear", type: "monstrosity", size: "Large", cr: 3, xp: 700 },
];

import type { ReferenceData } from "./reference";

export const FIXTURE_REFERENCE: ReferenceData = {
  spells: [
    { id: "test-fireball", name: "Fireball Test", level: 3, school: "Evocation", classes: ["Sorcerer", "Wizard"], castingTime: "Action", ritual: false,
      range: "150 feet", components: "V, S, M (a ball of bat guano)", duration: "Instantaneous", description: "A bright streak flashes.", higherLevel: "The damage increases by 1d6." },
    { id: "test-light", name: "Test Light", level: 0, school: "Evocation", classes: ["Cleric"], castingTime: "Action", ritual: false,
      range: "Touch", components: "V, M (a firefly)", duration: "1 hour", description: "You touch one object." },
  ],
  magicItems: [{ id: "test-bag", name: "Bag of Holding Test", category: "Wondrous Item", rarity: "Uncommon", attunement: "", desc: "This bag has an interior space.", variants: [] }],
  equipment: [
    { id: "test-longsword", name: "Longsword Test", categories: ["Weapons", "Martial Weapons"], cost: "15 gp", weight: 3, properties: ["Versatile"], desc: "", damage: "1d8 Slashing (1d10 two-handed)", mastery: "Sap" },
    { id: "test-plate", name: "Plate Test", categories: ["Armor", "Heavy Armor"], cost: "1500 gp", weight: 65, properties: [], desc: "", armorClass: "18", stealthDisadvantage: true, strMinimum: 15 },
  ],
  conditions: [{ id: "test-blinded", name: "Blinded", desc: "While you have the Blinded condition:\n**Can't See.** You can't see." }],
};
