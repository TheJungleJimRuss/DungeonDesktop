/** Shared tolerant text reading for the paste readers (spells, items and monsters). Pure. */

/** What every reader returns: only what was read in `fields`, lines it could not place in `unread`. */
export interface ReadResult<T> { name?: string; fields: Partial<T>; unread: string[] }

export const nothingRead = (r: ReadResult<unknown>) => !r.name && Object.keys(r.fields).length === 0;

/** Fixes characters PDFs, Live Text and web pages mangle: ligatures, curly quotes, dashes, minus signs, odd spaces. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ﬀ/g, "ff").replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl").replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl")
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[  -   　]/g, " ").replace(/[­​﻿]/g, "");
}

/** Cleaned lines, each trimmed with inner runs of spaces collapsed. Blank lines stay as "" (paragraph breaks). */
export const readLines = (text: string): string[] => cleanText(text).split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim());

/** Joins lines that were broken mid-sentence into paragraphs. A blank line, or a previous line ending a sentence, starts a new one. */
export function joinWrapped(lines: string[]): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of lines) {
    if (!line) { if (cur) out.push(cur); cur = ""; continue; }
    if (cur && /[.!?:;"')\]]$/.test(cur) && !/^[a-z]/.test(line)) { out.push(cur); cur = line; }
    else cur = cur ? `${cur} ${line}` : line;
  }
  if (cur) out.push(cur);
  return out;
}

/** True when a string has more "(" than ")". */
export const opens = (s: string) => (s.match(/\(/g) ?? []).length > (s.match(/\)/g) ?? []).length;

const CONTINUES = /(?:,|;|\b(?:Very|and|or|of|the|a|an|in|to|with))$/i;

/** Joins a line into the next non-blank one when it clearly breaks mid-phrase: open parenthesis, trailing comma/semicolon, or a dangling connector word. Blank lines stay. */
export function joinBroken(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (line && prev && (opens(prev) || CONTINUES.test(prev))) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}

export const splitList = (s: string) => s.split(",").map((c) => c.trim()).filter(Boolean);
