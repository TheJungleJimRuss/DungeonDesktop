import type { SpellData } from "../storage/customEntries";
import { joinBroken, joinWrapped, opens, readLines, splitList, type ReadResult } from "./normalize";

const LABEL = /^(Casting Time|Range|Components|Duration)\b\s*:?\s*(.*)$/i;
const LEVELED = /^Level\s+(\d)\s+([A-Za-z' -]+?)\s*(?:\(([^)]*)\))?$/i;
const CANTRIP = /^([A-Za-z' -]+?)\s+Cantrip\s*(?:\(([^)]*)\))?$/i;
const HIGHER = /^(?:Using a Higher-Level Spell Slot|Cantrip Upgrade)(?:\s*\.\s*|\s+|$)/i;
const KEYS: Record<string, keyof SpellData> = { "casting time": "castingTime", range: "range", components: "components", duration: "duration" };
const LABEL_FIELDS = new Set<string>(Object.values(KEYS));

/** Reads a 2024-layout spell (name, "Level N School (Classes)", labelled lines, description). */
export function readSpell(text: string): ReadResult<SpellData> {
  const lines = joinBroken(readLines(text));
  const fields: Partial<SpellData> = {};
  const unread: string[] = [];
  const descLines: string[] = [];
  let name: string | undefined;
  let nameLine: string | undefined;
  let phase: "head" | "labels" | "desc" = "head";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (phase === "desc") { descLines.push(line); continue; }
    if (!line) continue;
    const label = LABEL.exec(line);
    if (label) {
      phase = "labels";
      let value = label[2];
      // the value may sit on the next line, and wrapped (brackets still open) on following ones
      while ((value === "" || opens(value)) && i + 1 < lines.length && lines[i + 1] && !LABEL.test(lines[i + 1])) value = `${value} ${lines[++i]}`.trim();
      fields[KEYS[label[1].toLowerCase()] as "range"] = value;
      continue;
    }
    const leveled = phase === "head" ? LEVELED.exec(line) : null;
    const cantrip = phase === "head" && !leveled ? CANTRIP.exec(line) : null;
    if (leveled || cantrip) {
      fields.level = leveled ? Number(leveled[1]) : 0;
      fields.school = (leveled ? leveled[2] : cantrip![1]).trim();
      const cls = leveled ? leveled[3] : cantrip![2];
      if (cls) fields.classes = splitList(cls);
      continue;
    }
    // between the labels, a short line with no sentence punctuation is stray; anything else starts the description
    if (phase === "labels") {
      if (Object.keys(fields).filter((k) => LABEL_FIELDS.has(k)).length < 4 && line.length <= 40 && !/[.!?]$/.test(line)) { unread.push(line); continue; }
      phase = "desc"; descLines.push(line); continue;
    }
    if (nameLine === undefined && Object.keys(fields).length === 0) { nameLine = line; continue; }
    unread.push(line);
  }
  if (nameLine !== undefined) { if (Object.keys(fields).length) name = nameLine; else unread.unshift(nameLine); }
  const ct = fields.castingTime;
  if (ct !== undefined) {
    const stripped = ct.replace(/(?:,\s*|\s+)?\bor\s+Ritual\b/i, "").trim();
    fields.ritual = stripped !== ct; fields.castingTime = stripped;
  } else if ("level" in fields) fields.ritual = false;
  const desc: string[] = [];
  const higher: string[] = [];
  for (const p of joinWrapped(descLines)) (higher.length || HIGHER.test(p) ? higher : desc).push(p.replace(HIGHER, ""));
  if (desc.length) fields.desc = desc.join("\n\n");
  if (higher.length) fields.higherLevel = higher.join("\n\n");
  return { name, fields, unread };
}
