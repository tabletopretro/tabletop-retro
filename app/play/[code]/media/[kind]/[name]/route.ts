import { docImages, docSounds, docVideos, IMAGE_NAME_PATTERN, SOUND_NAME_PATTERN, VIDEO_NAME_PATTERN } from "@/lib/campaign-doc";
import { campaignById, campaignImagePath, campaignSoundPath, campaignVideoPath } from "@/lib/campaigns";
import { castPortraitPath } from "@/lib/characters";
import { playerAccess } from "@/lib/player-access";
import { serveMedia } from "@/lib/serve-file";
import type { TableSnapshot } from "@/lib/tables";

/** Only files the snapshot uses, only to a seated player. Every failure is a bare 404. */
export async function GET(request: Request, ctx: RouteContext<"/play/[code]/media/[kind]/[name]">) {
  const notFound = () => new Response(null, { status: 404 });
  const { code, kind, name } = await ctx.params;
  const { table, seat } = await playerAccess(code);
  if (!table || !seat) return notFound();
  const snapshot = table.snapshot as TableSnapshot;
  const campaign = campaignById(table.campaignId);
  if (!campaign || !snapshot?.doc) return notFound();

  if (kind === "images" && IMAGE_NAME_PATTERN.test(name) && docImages(snapshot.doc).includes(name)) {
    const file = campaignImagePath(campaign, name);
    return file ? serveMedia(request, file) : notFound();
  }
  if (kind === "videos" && VIDEO_NAME_PATTERN.test(name) && docVideos(snapshot.doc).includes(name)) {
    const file = campaignVideoPath(campaign, name);
    return file ? serveMedia(request, file) : notFound();
  }
  if (kind === "sounds" && SOUND_NAME_PATTERN.test(name) && docSounds(snapshot.doc).includes(name)) {
    const file = campaignSoundPath(campaign, name);
    return file ? serveMedia(request, file) : notFound();
  }
  // Portraits: only a cast member's, as the snapshot has it.
  const sitter = kind === "portraits" ? snapshot.cast?.find((c) => c.portrait === name) : undefined;
  if (sitter) {
    const file = castPortraitPath(sitter.id, name);
    return file ? serveMedia(request, file) : notFound();
  }
  return notFound();
}
