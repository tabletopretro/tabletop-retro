import { getCurrentUser } from "@/lib/auth/dal";
import { campaignForOwner } from "@/lib/campaigns";
import { tableEventStream } from "@/lib/table-events";
import { leadActivity } from "@/lib/activity-runtime";
import { listSeats, liveTable } from "@/lib/tables";

/** Owner only. */
export async function GET(request: Request, ctx: RouteContext<"/campaigns/[id]/table-events">) {
  const user = await getCurrentUser();
  const campaign = user ? campaignForOwner((await ctx.params).id, user.id) : null;
  const table = campaign ? liveTable(campaign.id) : null;
  if (!table) return new Response(null, { status: 404 });
  return tableEventStream(request, table.id, () => ({
    seats: listSeats(table.id),
    activity: leadActivity(table.id),
  }));
}
