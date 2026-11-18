// Pure conversion from the 5e-bits/5e-database 2024 monster records to this app's Monster shape.
// Used by scripts/build-srd.mjs and by tests. No I/O here.

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
const nameOf = (x) => (typeof x === "string" ? x : x.name);

function usageLabel(u) {
  if (!u) return "";
  if (u.type === "per day") return ` (${u.times}/Day${u.times_in_lair ? `, or ${u.times_in_lair}/Day in Lair` : ""})`;
  if (u.type === "recharge on roll") return ` (Recharge ${u.min_value === 6 ? "6" : `${u.min_value}-6`})`;
  if (u.type === "recharge after rest") return ` (Recharges after a ${(u.rest_types ?? []).map(cap).join(" or ")} Rest)`;
  return "";
}

const entries = (list) => (list ?? []).map((a) => ({ name: a.name + usageLabel(a.usage), desc: a.desc }));

function speedText(sp) {
  const parts = [];
  if (sp.walk) parts.push(sp.walk);
  for (const k of ["burrow", "climb", "fly", "swim"]) if (sp[k]) parts.push(`${cap(k)} ${sp[k]}${k === "fly" && sp.hover ? " (hover)" : ""}`);
  return parts.join(", ");
}

function sensesText(s) {
  const parts = [];
  for (const k of ["blindsight", "darkvision", "tremorsense", "truesight"]) if (s[k]) parts.push(`${cap(k)} ${s[k]}`);
  parts.push(`Passive Perception ${s.passive_perception}`);
  return parts.join(", ");
}

export function convertMonster(r) {
  const profs = r.proficiencies ?? [];
  const pick = (prefix) =>
    profs.filter((p) => p.proficiency.name.startsWith(prefix + ": "))
      .map((p) => `${p.proficiency.name.slice(prefix.length + 2)} ${sign(p.value)}`);
  const ac = r.armor_class[0];
  const m = {
    id: r.index,
    name: r.name,
    size: r.size,
    type: r.type,
    alignment: r.alignment,
    ac: ac.value,
    hp: r.hit_points,
    hpRoll: r.hit_points_roll,
    speed: speedText(r.speed),
    abilities: { str: r.strength, dex: r.dexterity, con: r.constitution, int: r.intelligence, wis: r.wisdom, cha: r.charisma },
    saves: pick("Saving Throw"),
    skills: pick("Skill"),
    vulnerabilities: (r.damage_vulnerabilities ?? []).map(cap),
    resistances: (r.damage_resistances ?? []).map(cap),
    immunities: (r.damage_immunities ?? []).map(cap),
    conditionImmunities: (r.condition_immunities ?? []).map(nameOf),
    senses: sensesText(r.senses),
    languages: r.languages || "None",
    cr: r.challenge_rating,
    xp: r.xp,
    pb: r.proficiency_bonus,
    traits: entries(r.special_abilities),
    actions: entries(r.actions),
    bonusActions: entries(r.bonus_actions),
    reactions: entries(r.reactions),
    legendaryActions: entries(r.legendary_actions),
  };
  const armor = (ac.armor ?? []).map(nameOf);
  if (armor.length) m.acNote = armor.join(", ");
  if (r.xp_in_lair) m.xpInLair = r.xp_in_lair;
  if (r.gear) m.gear = r.gear;
  if (m.legendaryActions.length) m.legendaryUses = 3; // every SRD 5.2.1 stat block: 3 uses (4 in lair)
  return m;
}

export function convertMonsters(records) {
  return records.map(convertMonster).sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Spells, magic items, equipment, conditions ----
const byName = (a, b) => a.name.localeCompare(b.name);

export function convertSpell(r) {
  // Upstream quirk: for some spells the components are glued onto the range ("Touch Component: V, S") and the list is empty.
  const glued = /^(.*?) Component: (.*)$/.exec(r.range);
  if (glued && !r.components?.length) r = { ...r, range: glued[1], components: glued[2].split(/,\s*/) };
  const mat = r.components.includes("M") && r.material ? ` (${r.material})` : "";
  const s = {
    id: r.index,
    name: r.name,
    level: r.level,
    school: r.school.name,
    classes: (r.classes ?? []).map(nameOf),
    castingTime: r.casting_time,
    ritual: !!r.ritual,
    range: r.range,
    components: r.components.join(", ") + mat,
    duration: r.concentration ? `Concentration, ${r.duration}` : r.duration,
    description: r.description,
  };
  if (r.higher_level) s.higherLevel = r.higher_level;
  return s;
}

export function convertMagicItem(r) {
  const m = {
    id: r.index,
    name: r.name,
    category: r.equipment_category?.name ?? "",
    rarity: r.rarity?.name ?? "",
    attunement: r.attunement ? `Requires attunement${r["limited-to"] ? ` by a ${r["limited-to"]}` : ""}` : "",
    desc: r.desc,
    variants: (r.variants ?? []).map(nameOf),
  };
  return m;
}

const dmg = (d) => (d ? `${d.damage_dice} ${nameOf(d.damage_type)}` : "");

export function convertEquipment(r) {
  const e = {
    id: r.index,
    name: r.name,
    categories: (r.equipment_categories ?? []).map(nameOf),
    cost: r.cost ? `${r.cost.quantity} ${r.cost.unit}` : "",
    properties: (r.properties ?? []).map(nameOf),
    desc: r.description ?? "",
  };
  if (r.weight) e.weight = r.weight;
  if (r.damage) e.damage = dmg(r.damage) + (r.two_handed_damage ? ` (${r.two_handed_damage.damage_dice} two-handed)` : "");
  if (r.mastery) e.mastery = nameOf(r.mastery);
  if (r.range) e.range = `${r.range.normal}${r.range.long ? `/${r.range.long}` : ""} ft.`;
  if (r.armor_class) {
    const ac = r.armor_class;
    e.armorClass = `${ac.base}${ac.dex_bonus ? ` + Dex modifier${ac.max_bonus ? ` (max ${ac.max_bonus})` : ""}` : ""}`;
    if (r.stealth_disadvantage) e.stealthDisadvantage = true;
    if (r.str_minimum) e.strMinimum = r.str_minimum;
  }
  if (r.contents?.length) e.contents = r.contents.map((c) => `${nameOf(c.item)}${c.quantity > 1 ? ` (${c.quantity})` : ""}`);
  if (r.notes?.length) e.desc = [e.desc, ...r.notes].filter(Boolean).join(" ");
  return e;
}

export function convertCondition(r) {
  return { id: r.index, name: r.name, desc: r.description };
}

export const convertSpells = (rs) => rs.map(convertSpell).sort(byName);
export const convertMagicItems = (rs) => rs.map(convertMagicItem).sort(byName);
export const convertEquipments = (rs) => rs.map(convertEquipment).sort(byName);
export const convertConditions = (rs) => rs.map(convertCondition).sort(byName);

// ---- Character data: feats, backgrounds, rules. Upstream references are flattened to display strings and plain ids. ----

const ABILITY_NAMES = { STR: "Strength", DEX: "Dexterity", CON: "Constitution", INT: "Intelligence", WIS: "Wisdom", CHA: "Charisma" };
const abilityName = (a) => ABILITY_NAMES[nameOf(a)] ?? nameOf(a);
const FEAT_CATEGORIES = { origin: "Origin", general: "General", "fighting-style": "Fighting Style", "epic-boon": "Epic Boon" };

export function convertFeat(r) {
  const p = r.prerequisites ?? {};
  const prereq = [
    p.minimum_level ? `Level ${p.minimum_level}+` : "",
    r.prerequisite_options?.desc ?? "",
    p.feature_named ? `${p.feature_named} feature` : "",
  ].filter(Boolean).join(", ");
  const f = { id: r.index, name: r.name, category: FEAT_CATEGORIES[r.type] ?? r.type, description: r.description };
  if (prereq) f.prerequisite = prereq;
  if (r.repeatable) f.repeatable = r.repeatable;
  return f;
}

const profName = (p) => nameOf(p).replace(/^(Skill|Tool): /, "");

export function convertBackground(r) {
  const b = {
    id: r.index,
    name: r.name,
    abilityScores: (r.ability_scores ?? []).map(abilityName),
    feat: { id: r.feat.index, name: r.feat.name + (r.feat.note ? ` (${r.feat.note})` : "") },
    skills: (r.proficiencies ?? []).filter((p) => nameOf(p).startsWith("Skill: ")).map(profName),
    tools: (r.proficiencies ?? []).filter((p) => nameOf(p).startsWith("Tool: ")).map(profName),
    equipment: (r.equipment_options ?? []).map((o) => o.desc),
  };
  const choices = (r.proficiency_choices ?? []).map((o) => o.desc);
  if (choices.length) b.proficiencyChoices = choices;
  return b;
}

const RULE_KINDS = { skill: "skill", language: "language", "damage-type": "damage-type", "weapon-property": "weapon-property", "weapon-mastery": "weapon-mastery", alignment: "alignment", "ability-score": "ability-score" };

export function convertRule(kind, r) {
  if (!RULE_KINDS[kind]) throw new Error(`unknown rule kind ${kind}`);
  const e = { id: r.index, kind, name: r.name, desc: r.description ?? "" };
  if (kind === "skill") e.ability = abilityName(r.ability_score);
  if (kind === "language") { e.rare = !!r.is_rare; if (r.note) e.note = r.note; }
  if (kind === "alignment") e.abbreviation = r.abbreviation;
  if (kind === "ability-score") { e.name = r.full_name; e.abbreviation = r.name; e.skills = (r.skills ?? []).map(nameOf); }
  return e;
}

export const convertFeats = (rs) => rs.map(convertFeat).sort(byName);
export const convertBackgrounds = (rs) => rs.map(convertBackground).sort(byName);
/** One converter per rules file; rules.json is the concatenation of all seven (see build-srd.mjs `join`). */
export const convertRules = (kind) => (rs) => rs.map((r) => convertRule(kind, r)).sort(byName);

// ---- Species, subspecies and traits. Cross references are flattened to { id, name } pairs. ----

const refOf = (r) => ({ id: r.index, name: r.name });

export function convertSpeciesEntry(r) {
  const size = r.size ?? (r.size_options?.from?.options ?? []).map((o) => o.size).join(" or ");
  return {
    id: r.index, name: r.name, type: r.type, size, speed: r.speed,
    traits: (r.traits ?? []).map(refOf), subspecies: (r.subspecies ?? []).map(refOf),
  };
}

export function convertSubspecies(r) {
  const s = { id: r.index, name: r.name, species: refOf(r.species) };
  if (r.damage_type) s.damageType = r.damage_type.name;
  s.traits = (r.traits ?? []).map(refOf);
  return s;
}

export function convertTrait(r) {
  const t = { id: r.index, name: r.name, description: r.description ?? "", species: (r.species ?? []).map(refOf) };
  if (r.subspecies?.length) t.subspecies = r.subspecies.map(refOf);
  return t;
}

export const convertSpecies = (rs) => rs.map(convertSpeciesEntry).sort(byName);
export const convertSubspeciesList = (rs) => rs.map(convertSubspecies).sort(byName);
export const convertTraits = (rs) => rs.map(convertTrait).sort(byName);

// ---- Classes, subclasses, features and level tables. Class rows and subclass rows share Levels.json. ----

const fixText = (s) => (s ?? "").replaceAll("â€™", "’");
const countOf = (o) => (o.choose === 1 ? "1" : String(o.choose));
const levelNumber = (ref) => Number(/(\d+)$/.exec(ref.index)[1]);
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
const nth = (n) => ORDINALS[n - 1];

function multiclassText(m) {
  const need = m.prerequisite_options
    ? m.prerequisite_options.from.options.map((o) => `${abilityName(o.ability_score)} ${o.minimum_score}`).join(" or ")
    : (m.prerequisites ?? []).map((p) => `${abilityName(p.ability_score)} ${p.minimum_score}`).join(" and ");
  const gains = [...(m.proficiencies ?? []).map(nameOf), ...(m.proficiency_choices ?? []).map((o) => `${countOf(o)} ${o.desc}`)];
  return [need && `Prerequisite: ${need}.`, gains.length && `Proficiencies gained: ${gains.join(", ")}.`].filter(Boolean).join(" ");
}

export function convertClass(r) {
  return {
    id: r.index, name: r.name, hitDie: r.hit_die, primaryAbility: r.primary_ability.desc,
    savingThrows: r.saving_throws.map(abilityName),
    proficiencies: r.proficiencies.map(nameOf).filter((p) => !p.startsWith("Saving Throw: ")),
    skillChoices: (r.proficiency_choices ?? []).map((o) => fixText(o.desc)).join("; "),
    startingEquipment: (r.starting_equipment_options ?? []).map((o) => fixText(o.desc)).join(" "),
    multiclass: multiclassText(r.multi_classing),
    subclasses: (r.subclasses ?? []).map(refOf),
  };
}

// class_specific keys -> table column label and value formatter (unknown keys fall back to a title-cased key).
const dieText = (n) => `d${n}`;
const COLUMNS = {
  rage_count: ["Rages"], rage_damage_bonus: ["Rage Damage", (n) => `+${n}`], weapon_mastery: ["Weapon Mastery"],
  bardic_inspiration_die: ["Bardic Inspiration", dieText], channel_divinity_charges: ["Channel Divinity"], wild_shape_uses: ["Wild Shape"],
  second_wind_uses: ["Second Wind"], martial_arts_die: ["Martial Arts", dieText], focus_points: ["Focus Points"],
  unarmored_movement_bonus: ["Unarmored Movement", (n) => `+${n} ft.`], favored_enemies: ["Favored Enemies"],
  sneak_attack: ["Sneak Attack", (o) => `${o.dice_count}d${o.dice_value}`], sorcery_points: ["Sorcery Points"], eldritch_invocations: ["Eldritch Invocations"],
};
const titleKey = (k) => k.split("_").map(cap).join(" ");

/** Level rows of one class as table rows. Columns that are empty or 0 at every level are dropped; a 0 elsewhere shows as an en dash. */
function levelRows(rows) {
  const cells = rows.map((r) => {
    const c = new Map();
    for (const [k, v] of Object.entries(r.class_specific ?? {})) {
      const [label, fmt] = COLUMNS[k] ?? [titleKey(k)];
      c.set(label, { raw: typeof v === "object" ? v : v, text: fmt ? fmt(v) : v });
    }
    const sc = r.spellcasting ?? {};
    if ("cantrips_known" in sc) c.set("Cantrips", { raw: sc.cantrips_known, text: sc.cantrips_known });
    if ("prepared_spells" in sc) c.set("Prepared Spells", { raw: sc.prepared_spells, text: sc.prepared_spells });
    for (let n = 1; n <= 9; n++) if (`spell_slots_level_${n}` in sc) c.set(nth(n), { raw: sc[`spell_slots_level_${n}`], text: sc[`spell_slots_level_${n}`] });
    return c;
  });
  const labels = [...new Set(cells.flatMap((c) => [...c.keys()]))].filter((l) => cells.some((c) => c.get(l) && c.get(l).raw !== 0));
  return rows.map((r, i) => {
    const columns = {};
    for (const l of labels) { const v = cells[i].get(l); columns[l] = !v || v.raw === 0 ? "—" : v.text; }
    return { level: r.level, profBonus: r.prof_bonus, columns, featureIds: r.features.map((f) => f.index) };
  });
}

/** One entry per class: { id, levels }. Subclass rows are skipped (a subclass's features come from the features list). */
export function convertClassLevels(rs) {
  const byClass = new Map();
  for (const r of rs) if (!r.subclass) byClass.set(r.class.index, [...(byClass.get(r.class.index) ?? []), r]);
  return [...byClass].map(([id, rows]) => ({ id, levels: levelRows(rows.sort((a, b) => a.level - b.level)) })).sort((a, b) => a.id.localeCompare(b.id));
}

export function convertSubclass(r) {
  return { id: r.index, name: r.name, class: refOf(r.class), summary: r.summary, description: fixText(r.description) };
}

export function convertClassFeature(r) {
  const f = { id: r.index, name: r.name, class: refOf(r.class) };
  if (r.subclass) f.subclass = refOf(r.subclass);
  f.level = levelNumber(r.level);
  f.description = fixText(r.description);
  return f;
}

export const convertClasses = (rs) => rs.map(convertClass).sort(byName);
export const convertSubclasses = (rs) => rs.map(convertSubclass).sort(byName);
export const convertClassFeatures = (rs) => rs.map(convertClassFeature).sort(byName);
