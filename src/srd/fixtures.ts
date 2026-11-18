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

import type { CharacterData } from "./character";

export const FIXTURE_CHARACTER: CharacterData = {
  feats: [
    { id: "test-alert", name: "Alert Test", category: "Origin", description: "You gain the following benefits.\n**Initiative Proficiency.** Add your Proficiency Bonus to Initiative." },
    { id: "test-grappler", name: "Grappler Test", category: "General", prerequisite: "Level 4+, Strength or Dexterity 13+", description: "You can grab foes." },
  ],
  backgrounds: [
    { id: "test-acolyte", name: "Acolyte Test", abilityScores: ["Intelligence", "Wisdom", "Charisma"], feat: { id: "test-alert", name: "Alert Test (Cleric)" },
      skills: ["Insight", "Religion"], tools: ["Calligrapher's Supplies"], equipment: ["Choose A or B: (A) Holy Symbol, 8 GP; or (B) 50 GP"], proficiencyChoices: ["Choose one Gaming Set"] },
  ],
  rules: [
    { id: "test-acrobatics", kind: "skill", name: "Acrobatics Test", desc: "Stay on your feet.", ability: "Dexterity" },
    { id: "test-common", kind: "language", name: "Common Test", desc: "", rare: false },
    { id: "test-primordial", kind: "language", name: "Primordial Test", desc: "", rare: true, note: "Includes the Aquan dialect." },
    { id: "test-sap", kind: "weapon-mastery", name: "Sap Test", desc: "The target has Disadvantage on its next attack roll." },
  ],
  species: [
    { id: "test-drake", name: "Drakeling Test", type: "Humanoid", size: "Medium", speed: 30,
      traits: [{ id: "test-scales", name: "Scales Test" }, { id: "test-sight", name: "Darksight Test" }], subspecies: [{ id: "test-drake-red", name: "Ancestor Test: Red" }] },
    { id: "test-sprite", name: "Spritekin Test", type: "Fey", size: "Small", speed: 25, traits: [{ id: "test-sight", name: "Darksight Test" }], subspecies: [] },
  ],
  subspecies: [
    { id: "test-drake-red", name: "Ancestor Test: Red", species: { id: "test-drake", name: "Drakeling Test" }, damageType: "Fire", traits: [{ id: "test-flame", name: "Flame Breath Test" }] },
  ],
  traits: [
    { id: "test-scales", name: "Scales Test", description: "Your skin is **armored** with scales.", species: [{ id: "test-drake", name: "Drakeling Test" }] },
    { id: "test-sight", name: "Darksight Test", description: "You can see in the dark.", species: [{ id: "test-drake", name: "Drakeling Test" }, { id: "test-sprite", name: "Spritekin Test" }] },
    { id: "test-flame", name: "Flame Breath Test", description: "You exhale fire.", species: [], subspecies: [{ id: "test-drake-red", name: "Ancestor Test: Red" }] },
  ],
  classes: [
    { id: "test-brute", name: "Savage Test", hitDie: 12, primaryAbility: "Strength", savingThrows: ["Strength", "Constitution"], proficiencies: ["Light Armor", "Shields"],
      skillChoices: "Choose 2: Athletics or Survival", startingEquipment: "(a) Greataxe or (b) 75 GP", multiclass: "Prerequisite: Strength 13.",
      levels: [
        { level: 1, profBonus: 2, columns: { Rages: 2, "Rage Damage": "+2" }, featureIds: ["test-rage", "test-brute-sub"] },
        { level: 2, profBonus: 2, columns: { Rages: 2, "Rage Damage": "+2" }, featureIds: [] },
      ], subclasses: [{ id: "test-path", name: "Path Test" }] },
    { id: "test-mage", name: "Mage Test", hitDie: 6, primaryAbility: "Intelligence", savingThrows: ["Intelligence", "Wisdom"], proficiencies: ["Daggers"],
      skillChoices: "Choose 2: Arcana or History", startingEquipment: "(a) Spellbook or (b) 55 GP", multiclass: "Prerequisite: Intelligence 13.",
      levels: [
        { level: 1, profBonus: 2, columns: { Cantrips: 3, "Prepared Spells": 4, "1st": 2, "2nd": "—" }, featureIds: ["test-casting"] },
        { level: 2, profBonus: 2, columns: { Cantrips: 3, "Prepared Spells": 5, "1st": 3, "2nd": "—" }, featureIds: [] },
      ], subclasses: [] },
  ],
  subclasses: [
    { id: "test-path", name: "Path Test", class: { id: "test-brute", name: "Savage Test" }, summary: "Fury Without End",
      description: "Brutes of this path **never** tire.", features: [{ id: "test-frenzy", name: "Frenzy Test", level: 3 }] },
  ],
  classFeatures: [
    { id: "test-rage", name: "Rage Test", class: { id: "test-brute", name: "Savage Test" }, level: 1, description: "You can enter a **Rage** as a Bonus Action." },
    { id: "test-brute-sub", name: "Savage Test Subclass", class: { id: "test-brute", name: "Savage Test" }, level: 1, description: "Choose a Brute subclass." },
    { id: "test-casting", name: "Casting Test", class: { id: "test-mage", name: "Mage Test" }, level: 1, description: "You can cast spells." },
    { id: "test-frenzy", name: "Frenzy Test", class: { id: "test-brute", name: "Savage Test" }, subclass: { id: "test-path", name: "Path Test" }, level: 3, description: "Extra damage while raging." },
  ],
};
