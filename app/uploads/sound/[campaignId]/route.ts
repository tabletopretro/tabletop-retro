import { getCurrentUser } from "@/lib/auth/dal";
import { SOUND_MAX_BYTES } from "@/lib/campaign-doc";
import { isSameOrigin } from "@/lib/same-origin";
import { STORAGE_FULL, storageLeft } from "@/lib/storage";
import { campaignForOwner, saveCampaignSound } from "@/lib/campaigns";

/**
 * Outside /campaigns so proxy.ts doesn't buffer the body. Guards itself: same origin, session,
 * ownership, size, type.
 */
export async function POST(request: Request, ctx: RouteContext<"/uploads/sound/[campaignId]">) {
  const fail = (status: number, error: string) => Response.json({ error }, { status });
  if (!isSameOrigin(request)) return fail(403, "Upload from Tabletop Retro itself");
  const user = await getCurrentUser();
  if (!user) return fail(401, "Sign in again to upload");
  const campaign = campaignForOwner((await ctx.params).campaignId, user.id);
  if (!campaign) return fail(404, "This campaign no longer exists");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > SOUND_MAX_BYTES) return fail(413, "Sounds can be up to 20 MB");
  const left = storageLeft(user.id);
  if (declared > left) return fail(413, STORAGE_FULL);
  if (!request.body) return fail(400, "Choose a sound");

  const result = await saveCampaignSound(campaign, request.body, left);
  if ("error" in result) {
    if (result.error === "too-large" && left < SOUND_MAX_BYTES) return fail(413, STORAGE_FULL);
    return result.error === "too-large" ? fail(413, "Sounds can be up to 20 MB") : fail(415, "Use an MP3, M4A, OGG or WAV file");
  }
  return Response.json({ name: result.name });
}
