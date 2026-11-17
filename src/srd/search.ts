/** Client-side search index over names (any list of things with a `name`). Fuzzy: case, accents and punctuation are ignored; partial words,
 *  missing or swapped letters and one-or-two-letter typos still match. Best matches first. */
export interface SearchIndex<T extends { name: string } = { name: string }> { items: { item: T; norm: string; words: string[] }[] }

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function buildIndex<T extends { name: string }>(entries: T[]): SearchIndex<T> {
  return { items: entries.map((item) => { const norm = normalize(item.name); return { item, norm, words: norm.split(" ") }; }) };
}

/** Damerau-Levenshtein distance (adjacent swaps cost 1), bounded: returns max+1 when beyond it. */
export function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

/** Score of one query token against one name word (higher is better, 0 = no match). */
function tokenScore(q: string, w: string): number {
  if (q === w) return 100;
  if (w.startsWith(q)) return 80;
  if (w.includes(q) && q.length >= 3) return 50;
  const tol = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if (tol) {
    const whole = distance(q, w, tol);
    const prefix = distance(q, w.slice(0, q.length), tol);
    const best = Math.min(whole, prefix);
    if (best <= tol) return 40 - best * 10 - (best === prefix && best < whole ? 5 : 0);
  }
  return 0;
}

export function search<T extends { name: string }>(index: SearchIndex<T>, query: string, limit = 20): T[] {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const hits: { item: T; score: number }[] = [];
  for (const it of index.items) {
    let total = 0;
    for (const t of tokens) {
      const best = Math.max(...it.words.map((w) => tokenScore(t, w)));
      if (!best) { total = 0; break; }
      total += best;
    }
    if (!total) continue;
    const whole = normalize(query);
    if (it.norm === whole) total += 100; else if (it.norm.startsWith(whole)) total += 30;
    hits.push({ item: it.item, score: total - it.norm.length * 0.1 });
  }
  hits.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return hits.slice(0, limit).map((h) => h.item);
}
