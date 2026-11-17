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
