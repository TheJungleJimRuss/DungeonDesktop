import { SKILLS, DEFAULT_ABILITIES, skillBonus } from "./sheet";
import type { PartyMember } from "../storage/party";

const PERCEPTION = SKILLS.find((s) => s.key === "perception")!;

/** 10 + the Perception skill modifier from the character sheet. Members with no sheet
 *  abilities (quick Party form) fall back to their typed Passive Perception. */
export function passivePerceptionOf(m: PartyMember): number {
  if (!m.abilities) return m.passivePerception;
  return 10 + skillBonus({ ...DEFAULT_ABILITIES, ...m.abilities }, PERCEPTION, m.level, m.skills?.perception);
}

/** Highest passive Perception in the party, with who has it; null for an empty party. */
export function highestPassive(members: PartyMember[]): { value: number; names: string[] } | null {
  if (members.length === 0) return null;
  const value = Math.max(...members.map(passivePerceptionOf));
  return { value, names: members.filter((m) => passivePerceptionOf(m) === value).map((m) => m.name) };
}
