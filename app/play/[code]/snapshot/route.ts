import { playerAccess } from "@/lib/player-access";

/** No seat, no snapshot. */
export async function GET(_request: Request, ctx: RouteContext<"/play/[code]/snapshot">) {
  const { table, seat } = await playerAccess((await ctx.params).code);
  if (!table || !seat) return new Response(null, { status: 403 });
  return Response.json(table.snapshot, { headers: { "Cache-Control": "no-store" } });
}
