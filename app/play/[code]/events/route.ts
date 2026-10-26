import { playerAccess } from "@/lib/player-access";
import { tableEventStream } from "@/lib/table-events";
import { playerView } from "@/lib/activity-runtime";

/** No seat, no feed. */
export async function GET(request: Request, ctx: RouteContext<"/play/[code]/events">) {
  const { table, seat } = await playerAccess((await ctx.params).code);
  if (!table || !seat) return new Response(null, { status: 403 });
  return tableEventStream(request, table.id, () => playerView(table.id, seat.id));
}
