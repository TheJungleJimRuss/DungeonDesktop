import { requestRoll } from "../dice/roller";

/** Splits Stat Block text into plain text and clickable rolls: an attack bonus ("Attack Roll: +4") rolls 1d20+4,
 *  a damage expression ("(1d6 + 2)") rolls as written. Results land in the Dice Roller history. */
const PATTERN = /(Attack Roll:\s*)([+\-−]\d+)|\((\d*d\d+(?:\s*[+\-−]\s*\d+)?)\)/g;

export function RollableText({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const at = m.index ?? 0;
    out.push(text.slice(last, at));
    if (m[2]) {
      const bonus = m[2].replace("−", "-");
      out.push(m[1], <button key={at} type="button" className="roll-link" aria-label={`Roll attack ${bonus}`}
        onClick={() => requestRoll(`1d20${bonus}`)}>{m[2]}</button>);
    } else {
      const expr = m[3].replace("−", "-");
      out.push("(", <button key={at} type="button" className="roll-link" aria-label={`Roll damage ${expr}`}
        onClick={() => requestRoll(expr)}>{m[3]}</button>, ")");
    }
    last = at + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}
