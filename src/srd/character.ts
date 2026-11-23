/** SRD character data (feats, backgrounds, rules, species, classes): its own lazy chunk, loaded by search
 *  next to monsters and reference data. Upstream references are already flattened to strings and ids by the converter. */
export interface Feat {
  id: string; name: string; category: string; description: string; prerequisite?: string; repeatable?: string;
}
export interface Background {
  id: string; name: string; abilityScores: string[]; feat: { id: string; name: string }; skills: string[]; tools: string[];
  equipment: string[]; proficiencyChoices?: string[];
  /** Set on hand-written entries that are not in SRD 5.2.1 (src/data/extra/). Their feat id is "" when the feat isn't in the SRD. */
  source?: string;
}
export interface NameRef { id: string; name: string }
export interface Species { id: string; name: string; type: string; size: string; speed: number; traits: NameRef[]; subspecies: NameRef[] }
export interface Subspecies { id: string; name: string; species: NameRef; damageType?: string; traits: NameRef[] }
export interface Trait { id: string; name: string; description: string; species: NameRef[]; subspecies?: NameRef[] }
export interface ClassLevel { level: number; profBonus: number; columns: Record<string, string | number>; featureIds: string[] }
export interface Class {
  /** Optional in the data; autoSheet falls back to a name table. */
  spellcastingAbility?: "str" | "dex" | "con" | "int" | "wis" | "cha";
  id: string; name: string; hitDie: number; primaryAbility: string; savingThrows: string[]; proficiencies: string[];
  skillChoices: string; startingEquipment: string; multiclass: string; levels: ClassLevel[]; subclasses: NameRef[];
}
/** A subclass's features come from the class-feature list (the ones that name it), grouped by level when the data loads. */
export interface Subclass { id: string; name: string; class: NameRef; summary: string; description: string; features: (NameRef & { level: number })[] }
export interface ClassFeature { id: string; name: string; class: NameRef; subclass?: NameRef; level: number; description: string }
export type RuleKind = "skill" | "language" | "damage-type" | "weapon-property" | "weapon-mastery" | "alignment" | "ability-score";
export interface Rule {
  id: string; kind: RuleKind; name: string; desc: string;
  ability?: string; rare?: boolean; note?: string; abbreviation?: string; skills?: string[];
}
export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  skill: "Skill", language: "Language", "damage-type": "Damage type", "weapon-property": "Weapon property",
  "weapon-mastery": "Weapon mastery", alignment: "Alignment", "ability-score": "Ability score",
};

/** Everything the character-data chunk holds. Later tickets add species, classes, … here and in loadCharacterData. */
export interface CharacterData {
  feats: Feat[]; backgrounds: Background[]; rules: Rule[]; species: Species[]; subspecies: Subspecies[]; traits: Trait[];
  classes: Class[]; subclasses: Subclass[]; classFeatures: ClassFeature[];
}

export type CharacterSource = () => Promise<CharacterData>;
const bundled: CharacterSource = async () => {
  const [feats, backgrounds, rules, species, subspecies, traits, classes, classLevels, subclasses, classFeatures, extraBackgrounds] = await Promise.all([
    import("../data/srd/feats.json"), import("../data/srd/backgrounds.json"), import("../data/srd/rules.json"),
    import("../data/srd/species.json"), import("../data/srd/subspecies.json"), import("../data/srd/traits.json"),
    import("../data/srd/classes.json"), import("../data/srd/class-levels.json"), import("../data/srd/subclasses.json"), import("../data/srd/class-features.json"),
    import("../data/extra/backgrounds-phb2024.json"),
  ]);
  const features = classFeatures.default as ClassFeature[];
  const levels = new Map((classLevels.default as { id: string; levels: ClassLevel[] }[]).map((c) => [c.id, c.levels]));
  return {
    feats: feats.default as Feat[], backgrounds: [...(backgrounds.default as Background[]), ...(extraBackgrounds.default as Background[])].sort((a, b) => a.name.localeCompare(b.name)), rules: rules.default as Rule[],
    species: species.default as Species[], subspecies: subspecies.default as Subspecies[], traits: traits.default as Trait[],
    classes: (classes.default as Omit<Class, "levels">[]).map((c) => ({ ...c, levels: levels.get(c.id) ?? [] })),
    subclasses: (subclasses.default as Omit<Subclass, "features">[]).map((sc) => ({
      ...sc, features: features.filter((f) => f.subclass?.id === sc.id).map((f) => ({ id: f.id, name: f.name, level: f.level })).sort((a, b) => a.level - b.level),
    })),
    classFeatures: features,
  };
};
let source: CharacterSource = bundled;
let cache: Promise<CharacterData> | null = null;

export function loadCharacterData(): Promise<CharacterData> { return (cache ??= source()); }
/** Test hook: use a small fixture instead of the bundled data (null restores the bundle). */
export function setCharacterSource(s: CharacterSource | null) { source = s ?? bundled; cache = null; }
