/** Pure fantasy-name logic. The random source is injected so tests are deterministic
 *  (same pattern as src/dice/dice.ts). All word parts are original to this project. */
export type Rng = () => number; // [0, 1), like Math.random

export type NameStyleId = "any" | "elven" | "dwarven" | "human" | "halfling" | "orcish";

interface Parts { first: string[][]; last?: string[][] }
const syl = (s: string) => s.split(" ");

/** Each name part is a list of syllable pools, joined in order (one pick per pool). */
const PARTS: Record<Exclude<NameStyleId, "any">, Parts> = {
  elven: {
    first: [syl("Ae El Fa Ili Lor Mi Sae Thal Vae Yri Cal Isi"), syl("an ri la nor the vi sa lu mi dra"), syl("el ia wen ira dor ael is yth ar on en")],
    last: [syl("Moon Silver Star Dawn Leaf Night Dusk Sun"), syl("whisper song shade bloom brook runner weaver glade")],
  },
  dwarven: {
    first: [syl("Bor Dur Gim Thor Kaz Bal Dun Hrad Mor Rag Tor Vor"), syl("in ak um gar dak ri ol bek"), syl("din rik li grim ar gan bur dal")],
    last: [syl("Iron Stone Deep Anvil Coal Rune Gold Hammer"), syl("beard fist forge helm delver brow hold crag")],
  },
  human: {
    first: [syl("Al Bren Cal Da Ed Fen Gar Hal Jo Mar Ro Tam Wil Ysa"), syl("ar e i o a ei"), syl("dric na ric ton ra bel wyn lin mund ta")],
    last: [syl("Ash Black Brook Cart Hart Mill Thorn West Wood Fair Stan Crow"), syl("ford field wright smith wick ley worth ton man ridge")],
  },
  halfling: {
    first: [syl("Pip Bil Mer Tob Lin Fro Per Cos Rosy Nim Dill Wob"), syl("o a i e y bo"), syl("bin ry wick mo na kin di lo pin")],
    last: [syl("Under Green Tea Good Brandy Soft Burrow Apple Merry Hill"), syl("hill bottom barrel foot leaf cakes bush pie thistle")],
  },
  orcish: {
    first: [syl("Gru Mok Zug Rak Throg Ug Dur Skar Brug Naz Grosh Vog"), syl("sh k r g z"), syl("ak ug ar osh ul ok az")],
    last: [syl("Bone Skull Blood Grim Red Ash Iron Black"), syl("render crusher biter splitter fang gouger howl maw")],
  },
};

export const STYLES: { id: NameStyleId; label: string }[] = [
  { id: "any", label: "Any style" },
  { id: "elven", label: "Elven" },
  { id: "dwarven", label: "Dwarven" },
  { id: "human", label: "Human" },
  { id: "halfling", label: "Halfling" },
  { id: "orcish", label: "Orcish" },
];

const pick = <T,>(rng: Rng, xs: T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const build = (rng: Rng, pools: string[][]) => cap(pools.map((p) => pick(rng, p)).join("").toLowerCase());

/** One full name ("First Last") in the given style. */
export function generateName(rng: Rng, style: NameStyleId): string {
  const key = style === "any" ? pick(rng, Object.keys(PARTS) as (keyof typeof PARTS)[]) : style;
  const parts = PARTS[key];
  const first = build(rng, parts.first);
  return parts.last ? `${first} ${build(rng, parts.last)}` : first;
}

/** `count` distinct names (distinct unless the pool is exhausted, which these are far too big for). */
export function generateNames(rng: Rng, style: NameStyleId, count: number): string[] {
  const out = new Set<string>();
  for (let tries = 0; out.size < count && tries < count * 50; tries++) out.add(generateName(rng, style));
  return [...out];
}
