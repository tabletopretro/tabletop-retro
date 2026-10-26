import { playerAccess } from "@/lib/player-access";
import { playerView } from "@/lib/activity-runtime";

/** For clients that can't hold a stream. No seat, 403. */
export async function GET(_request: Request, ctx: RouteContext<"/play/[code]/state">) {
  const { table, seat } = await playerAccess((await ctx.params).code);
  if (!table) return Response.json({ open: false }, { headers: { "Cache-Control": "no-store" } });
  if (!seat) return new Response(null, { status: 403 });
  return Response.json(playerView(table.id, seat.id), { headers: { "Cache-Control": "no-store" } });
}
