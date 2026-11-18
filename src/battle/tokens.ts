/** Short on-token label: initials plus any trailing number, so copies differ ("Goblin Warrior 2" -> "GW2", "Thia" -> "TH"). */
export function tokenLabel(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const num = words.length > 1 && /^\d+$/.test(words[words.length - 1]) ? words.pop()! : "";
  const letters = words.filter((w) => /\p{L}/u.test(w));
  const base = letters.length > 1 || num ? letters.slice(0, 2).map((w) => [...w.replace(/[^\p{L}]/gu, "")][0] ?? "").join("") : [...(letters[0] ?? name)].slice(0, 2).join("");
  return (base.toUpperCase() + num).slice(0, 4);
}
