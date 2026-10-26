import { getCurrentUser } from "@/lib/auth/dal";
import { campaignForOwner, campaignSoundPath } from "@/lib/campaigns";
import { serveMedia } from "@/lib/serve-file";

/** Owner-only; every failure is a bare 404 so ids and names can't be probed. */
export async function GET(request: Request, ctx: RouteContext<"/campaigns/[id]/sounds/[name]">) {
  const notFound = () => new Response(null, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return notFound();
  const { id, name } = await ctx.params;
  const campaign = campaignForOwner(id, user.id);
  const file = campaign ? campaignSoundPath(campaign, name) : null;
  return file ? serveMedia(request, file) : notFound();
}
