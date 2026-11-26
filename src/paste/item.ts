import type { ItemData } from "../storage/customEntries";
import { joinBroken, joinWrapped, readLines, type ReadResult } from "./normalize";

const RARITY = "Common|Uncommon|Rare|Very Rare|Legendary|Artifact|Rarity Varies";
const HEADER = new RegExp(`^(.+?)\\s*,\\s*(${RARITY})\\s*(?:\\(([^)]*)\\))?\\s*$`, "i");

/** Reads a 2024-layout magic item: name, "Type, Rarity (Requires Attunement ...)", then the description. */
export function readItem(text: string): ReadResult<ItemData> {
  const lines = joinBroken(readLines(text));
  while (lines.length && !lines[0]) lines.shift();
  const fields: Partial<ItemData> = {};
  const unread: string[] = [];
  // the header may be the first line (no name line) or the one after the name
  let nameLine: string | undefined;
  if (!(lines[0] && HEADER.test(lines[0]))) { nameLine = lines.shift(); while (lines.length && !lines[0]) lines.shift(); }
  const header = lines.shift();
  const m = header === undefined ? null : HEADER.exec(header);
  if (m) {
    fields.type = m[1].trim();
    fields.rarity = m[2];
    fields.attunement = m[3]?.trim() ?? "";
  } else if (header) unread.push(header);
  const desc = joinWrapped(lines).join("\n\n");
  if (desc) fields.desc = desc;
  let name: string | undefined;
  if (nameLine) { if (Object.keys(fields).length) name = nameLine; else unread.unshift(nameLine); }
  return { name, fields, unread };
}
