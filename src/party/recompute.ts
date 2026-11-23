import { getDb } from "../storage/db";
import { updatePartyMember, type PartyMember } from "../storage/party";
import { loadCharacterData } from "../srd/character";
import { applyAuto } from "./autoSheet";
import { XP_THRESHOLDS } from "./xp";

/** Re-runs the auto fields on a stored member and saves the result. Call after anything that changes level, class,
 *  species, background or abilities outside the form (e.g. awarding XP). Resolves to the updated member, or null if it is gone. */
export async function applyAutoAndSave(memberId: string): Promise<PartyMember | null> {
  const member = (await (await getDb()).get("party", memberId)) as unknown as PartyMember | undefined;
  if (!member) return null;
  const { id: _id, campaignId: _c, ...next } = applyAuto(member, await loadCharacterData());
  await updatePartyMember(memberId, next);
  return { ...next, id: memberId, campaignId: member.campaignId };
}

/** Adds XP to a stored member (a member with no XP yet starts from the floor of their typed level, so awarding never lowers it),
 *  then re-runs the auto fields. Resolves to the level before and after, or null if the member is gone. */
export async function awardXp(memberId: string, amount: number): Promise<{ before: number; after: number; xp: number } | null> {
  const member = (await (await getDb()).get("party", memberId)) as unknown as PartyMember | undefined;
  if (!member) return null;
  const start = Number.isFinite(member.xp) ? member.xp! : XP_THRESHOLDS[Math.min(20, Math.max(1, member.level)) - 1];
  const xp = start + Math.max(0, Math.floor(amount));
  await updatePartyMember(memberId, { xp });
  const next = await applyAutoAndSave(memberId);
  return { before: member.level, after: next?.level ?? member.level, xp };
}

/** Sets a stored member's XP total (may lower it, for corrections), then re-runs the auto fields.
 *  Resolves to the level before and after, or null if the member is gone. */
export async function setXp(memberId: string, total: number): Promise<{ before: number; after: number; xp: number } | null> {
  const member = (await (await getDb()).get("party", memberId)) as unknown as PartyMember | undefined;
  if (!member) return null;
  const xp = Math.max(0, Math.floor(total));
  await updatePartyMember(memberId, { xp });
  const next = await applyAutoAndSave(memberId);
  return { before: member.level, after: next?.level ?? member.level, xp };
}
