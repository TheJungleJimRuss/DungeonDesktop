/** SRD 5.2 monsters: the Monster shape (also the shape custom entries will use) and the lazy loader. */
export interface Entry { name: string; desc: string }

export interface Monster {
  id: string;
  name: string;
  size: string;
  type: string;
  alignment: string;
  ac: number;
  acNote?: string;
  hp: number;
  hpRoll: string;
  speed: string;
  abilities: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  saves: string[];
  skills: string[];
  vulnerabilities: string[];
  resistances: string[];
  immunities: string[];
  conditionImmunities: string[];
  senses: string;
  languages: string;
  cr: number;
  xp: number;
  xpInLair?: number;
  pb: number;
  gear?: string;
  traits: Entry[];
  actions: Entry[];
  bonusActions: Entry[];
  reactions: Entry[];
  legendaryActions: Entry[];
  legendaryUses?: number;
  lairActions?: Entry[];
}

export type MonsterSource = () => Promise<Monster[]>;

/** The bundled data is its own chunk: it is only fetched (from this site) the first time it is needed. */
const bundled: MonsterSource = async () => (await import("../data/srd/monsters.json")).default as Monster[];

let source: MonsterSource = bundled;
let cache: Promise<Monster[]> | null = null;

export function loadMonsters(): Promise<Monster[]> {
  return (cache ??= source());
}

/** Test hook: use a small fixture instead of the bundled SRD (null restores the bundle). */
export function setMonsterSource(s: MonsterSource | null) {
  source = s ?? bundled;
  cache = null;
}

export async function getMonster(id: string): Promise<Monster | undefined> {
  return (await loadMonsters()).find((m) => m.id === id);
}

const FRACTIONS: Record<number, string> = { 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" };
export const crLabel = (cr: number) => FRACTIONS[cr] ?? String(cr);

/** Fills anything a hand-edited or imported monster leaves out, so the Stat Block and combat never crash on it. */
export function normalizeMonster(m: Partial<Monster> & { id: string; name: string }): Monster {
  const list = (v: unknown): Entry[] => (Array.isArray(v) ? v : []).map((e: Partial<Entry>) => ({ name: String(e?.name ?? ""), desc: String(e?.desc ?? "") }));
  const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const ab = (m.abilities ?? {}) as Partial<Monster["abilities"]>;
  return {
    ...m,
    size: m.size ?? "Medium", type: m.type ?? "creature", alignment: m.alignment ?? "unaligned",
    ac: num(m.ac, 10), hp: num(m.hp, 1), hpRoll: m.hpRoll ?? "", speed: m.speed ?? "",
    abilities: { str: num(ab.str, 10), dex: num(ab.dex, 10), con: num(ab.con, 10), int: num(ab.int, 10), wis: num(ab.wis, 10), cha: num(ab.cha, 10) },
    saves: strs(m.saves), skills: strs(m.skills), vulnerabilities: strs(m.vulnerabilities), resistances: strs(m.resistances),
    immunities: strs(m.immunities), conditionImmunities: strs(m.conditionImmunities),
    senses: m.senses ?? "", languages: m.languages ?? "", cr: num(m.cr, 0), xp: num(m.xp, 0), pb: num(m.pb, 2),
    traits: list(m.traits), actions: list(m.actions), bonusActions: list(m.bonusActions), reactions: list(m.reactions),
    legendaryActions: list(m.legendaryActions), lairActions: m.lairActions ? list(m.lairActions) : undefined,
  };
}
