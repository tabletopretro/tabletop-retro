"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { STORAGE_FULL, storageLeft } from "@/lib/storage";
import { IMAGE_MAX_BYTES, IMAGE_NAME_PATTERN, parseCampaignDoc, SOUND_NAME_PATTERN, VIDEO_NAME_PATTERN } from "@/lib/campaign-doc";
import {
  CAMPAIGN_TITLE_MAX,
  campaignForOwner,
  deleteCampaign,
  detectImageType,
  normalizeCampaignTitle,
  renameCampaign,
  saveCampaignDoc,
  saveCampaignImage,
} from "@/lib/campaigns";
import { castMembers } from "@/lib/character-doc";
import { listCharacters, syncCast } from "@/lib/characters";
import { liveTable, liveTableMedia, refreshSnapshot, snapshotOf } from "@/lib/tables";

/* Every export is a public endpoint: re-check session and ownership; id and payload are hostile. */

async function ownedCampaign(campaignId: unknown) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const campaign = typeof campaignId === "string" ? campaignForOwner(campaignId, user.id) : null;
  return campaign ? { user, campaign } : null;
}

export type RenameState = { ok: true; title: string } | { ok: false; error: string };

export async function renameCampaignAction(campaignId: string, raw: string): Promise<RenameState> {
  const owned = await ownedCampaign(campaignId);
  if (!owned) return { ok: false, error: "This campaign no longer exists" };
  const title = normalizeCampaignTitle(String(raw ?? ""));
  if (!title) return { ok: false, error: `Name it in 1–${CAMPAIGN_TITLE_MAX} characters` };
  const result = renameCampaign(owned.campaign, owned.user.id, title);
  if ("error" in result) return { ok: false, error: `You already have a campaign called "${title}"` };
  return { ok: true, title: result.title };
}

export type SaveState = { ok: true } | { ok: false; error: string };

/**
 * `keep` names images, videos and sounds the editor's undo history can still bring back, so
 * the prune spares them. Untrusted like everything else: only names we
 * could have generated count, and the list is capped. At worst a bogus
 * list keeps a few orphaned files in the caller's own campaign.
 */
export async function saveCampaignDocAction(
  campaignId: string,
  raw: unknown,
  keep: unknown = [],
): Promise<SaveState> {
  const owned = await ownedCampaign(campaignId);
  if (!owned) return { ok: false, error: "This campaign no longer exists" };
  const doc = parseCampaignDoc(raw, owned.campaign.title);
  if (!doc) return { ok: false, error: "Something in this campaign couldn't be saved" };
  const kept = Array.isArray(keep)
    ? keep
        .filter((n): n is string => typeof n === "string" && (IMAGE_NAME_PATTERN.test(n) || VIDEO_NAME_PATTERN.test(n) || SOUND_NAME_PATTERN.test(n)))
        .slice(0, 500)
    : [];
  // Only the owner's own characters stay in the cast.
  const cast = syncCast(owned.campaign.id, owned.user.id, doc.cast);
  // An open table's snapshot may show media the TL has since removed;
  // keep it. Table trouble must never cost the TL their save, so it's
  // read defensively and the save goes ahead regardless.
  let tableMedia: string[] = [];
  try {
    tableMedia = liveTableMedia(owned.campaign.id);
  } catch (error) {
    console.error("Couldn't read the open table's media; saving anyway", error);
  }
  saveCampaignDoc(owned.campaign, { ...doc, cast }, [...kept, ...tableMedia]);
  // An open table shows players what's saved, so they get this save now.
  try {
    const table = liveTable(owned.campaign.id);
    if (table) {
      const members = castMembers(cast, listCharacters(owned.user.id));
      refreshSnapshot(table.id, snapshotOf({ ...doc, cast }, members));
    }
  } catch (error) {
    console.error("Saved, but couldn't refresh the open table for players", error);
  }
  return { ok: true };
}

export type UploadState = { ok: true; name: string } | { ok: false; error: string };

export async function uploadPageImageAction(
  campaignId: string,
  formData: FormData,
): Promise<UploadState> {
  const owned = await ownedCampaign(campaignId);
  if (!owned) return { ok: false, error: "This campaign no longer exists" };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image" };
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, error: "Images can be up to 5 MB" };
  if (file.size > storageLeft(owned.user.id)) return { ok: false, error: STORAGE_FULL };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = detectImageType(bytes);
  if (!ext) return { ok: false, error: "Use a WebP, PNG, JPEG or GIF" };
  return { ok: true, name: saveCampaignImage(owned.campaign, bytes, ext) };
}

export type DeleteState = { ok: false; error: string };

export async function deleteCampaignAction(campaignId: string): Promise<DeleteState> {
  const owned = await ownedCampaign(campaignId);
  if (!owned) redirect("/library");
  const result = deleteCampaign(owned.campaign);
  if ("error" in result) {
    return { ok: false, error: "This campaign has tables, so it can't be deleted yet" };
  }
  redirect("/library");
}
