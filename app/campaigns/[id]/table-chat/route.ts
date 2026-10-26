import { getCurrentUser } from "@/lib/auth/dal";
import { campaignForOwner } from "@/lib/campaigns";
import { chatHistory } from "@/lib/table-chat";
import { chatEventStream } from "@/lib/table-events";
import { liveTable } from "@/lib/tables";

/** Owner only. */
export async function GET(request: Request, ctx: RouteContext<"/campaigns/[id]/table-chat">) {
  const user = await getCurrentUser();
  const campaign = user ? campaignForOwner((await ctx.params).id, user.id) : null;
  const table = campaign ? liveTable(campaign.id) : null;
  if (!table) return new Response(null, { status: 404 });
  return chatEventStream(request, table.id, () => chatHistory(table.id));
}
