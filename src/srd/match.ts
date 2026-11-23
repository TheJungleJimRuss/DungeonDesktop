/** Finds the SRD entry whose name equals `text` (case-insensitive, trimmed); undefined means custom or blank. */
export function matchSrd<T extends { name: string }>(text: string | undefined, entries: T[]): T | undefined {
  const t = (text ?? "").trim().toLowerCase();
  return t ? entries.find((e) => e.name.toLowerCase() === t) : undefined;
}
