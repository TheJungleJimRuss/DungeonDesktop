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
