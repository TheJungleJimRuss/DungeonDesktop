/** SRD reference types besides monsters (spells, magic items, equipment, conditions), their lazy loaders, and
 *  one search over all five types. Monsters live in ./monsters (same pattern: own lazy chunk per type). */
import { loadMonsters, type Monster } from "./monsters";
import { buildIndex, search, type SearchIndex } from "./search";

export interface Spell {
  id: string; name: string; level: number; school: string; classes: string[]; castingTime: string; ritual: boolean;
  range: string; components: string; duration: string; description: string; higherLevel?: string;
}
export interface MagicItem { id: string; name: string; category: string; rarity: string; attunement: string; desc: string; variants: string[] }
export interface EquipmentItem {
  id: string; name: string; categories: string[]; cost: string; weight?: number; properties: string[]; desc: string;
  damage?: string; mastery?: string; range?: string; armorClass?: string; stealthDisadvantage?: boolean; strMinimum?: number; contents?: string[];
}
export interface Condition { id: string; name: string; desc: string }

export interface ReferenceData { spells: Spell[]; magicItems: MagicItem[]; equipment: EquipmentItem[]; conditions: Condition[] }
export interface SearchData extends ReferenceData { monsters: Monster[] }

export type RefType = "monster" | "spell" | "magic-item" | "equipment" | "condition";
export type RefHit =
  | { type: "monster"; entry: Monster }
  | { type: "spell"; entry: Spell }
  | { type: "magic-item"; entry: MagicItem }
  | { type: "equipment"; entry: EquipmentItem }
  | { type: "condition"; entry: Condition };

export const REF_TYPES: { type: RefType; label: string }[] = [
  { type: "monster", label: "Monsters" }, { type: "spell", label: "Spells" }, { type: "magic-item", label: "Magic Items" },
  { type: "equipment", label: "Equipment" }, { type: "condition", label: "Conditions" },
];

export type ReferenceSource = () => Promise<ReferenceData>;
const bundled: ReferenceSource = async () => {
  const [spells, magicItems, equipment, conditions] = await Promise.all([
    import("../data/srd/spells.json"), import("../data/srd/magic-items.json"),
    import("../data/srd/equipment.json"), import("../data/srd/conditions.json"),
  ]);
  return { spells: spells.default as Spell[], magicItems: magicItems.default as MagicItem[], equipment: equipment.default as EquipmentItem[], conditions: conditions.default as Condition[] };
};
let source: ReferenceSource = bundled;
let cache: Promise<ReferenceData> | null = null;

export function loadReference(): Promise<ReferenceData> { return (cache ??= source()); }
/** Test hook: use a small fixture instead of the bundled data (null restores the bundle). */
export function setReferenceSource(s: ReferenceSource | null) { source = s ?? bundled; cache = null; }

export async function loadSearchData(): Promise<SearchData> {
  const [monsters, ref] = await Promise.all([loadMonsters(), loadReference()]);
  return { monsters, ...ref };
}

export async function getReferenceEntry(type: RefType, id: string): Promise<RefHit | undefined> {
  const data = await loadSearchData();
  const list: { id: string }[] = { monster: data.monsters, spell: data.spells, "magic-item": data.magicItems, equipment: data.equipment, condition: data.conditions }[type];
  const entry = list.find((x) => x.id === id);
  return entry && ({ type, entry } as RefHit);
}

export interface SearchOptions { type?: RefType; cr?: number; creatureType?: string; limit?: number }

const indexes = new WeakMap<object[], SearchIndex<{ name: string }>>();
function indexOf<T extends { name: string }>(list: T[]): SearchIndex<T> {
  let i = indexes.get(list);
  if (!i) indexes.set(list, (i = buildIndex(list)));
  return i as SearchIndex<T>;
}

/** Search all types (or one). Results are grouped by type in REF_TYPES order, best match first within a type.
 *  CR and creature-type filters apply to monsters only; with one of them set, an empty query lists every match. */
export function searchReference(data: SearchData, query: string, opts: SearchOptions = {}): RefHit[] {
  const { type, cr, creatureType } = opts;
  const out: RefHit[] = [];
  const want = (t: RefType) => !type || type === t;
  const group = <T extends { name: string }>(t: RefType, list: T[], limit: number, hit: (e: T) => RefHit) => {
    if (!want(t)) return;
    for (const e of search(indexOf(list), query, limit)) out.push(hit(e));
  };
  const limit = opts.limit ?? 20;
  if (want("monster")) {
    const filtered = cr !== undefined || !!creatureType;
    let list = data.monsters;
    if (filtered) list = list.filter((m) => (cr === undefined || m.cr === cr) && (!creatureType || m.type === creatureType));
    if (!query.trim() && filtered) for (const m of [...list].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 100)) out.push({ type: "monster", entry: m });
    else for (const m of search(filtered ? buildIndex(list) : indexOf(list), query, limit)) out.push({ type: "monster", entry: m });
  }
  group("spell", data.spells, limit, (entry) => ({ type: "spell", entry }));
  group("magic-item", data.magicItems, limit, (entry) => ({ type: "magic-item", entry }));
  group("equipment", data.equipment, limit, (entry) => ({ type: "equipment", entry }));
  group("condition", data.conditions, limit, (entry) => ({ type: "condition", entry }));
  return out;
}

/** The distinct challenge ratings and creature types present, for the filter menus. */
export function monsterFilterOptions(monsters: Monster[]): { crs: number[]; types: string[] } {
  return {
    crs: [...new Set(monsters.map((m) => m.cr))].sort((a, b) => a - b),
    types: [...new Set(monsters.map((m) => m.type))].sort(),
  };
}

export const spellLevelLabel = (s: Spell) => (s.level === 0 ? `${s.school} cantrip` : `Level ${s.level} ${s.school}`);
