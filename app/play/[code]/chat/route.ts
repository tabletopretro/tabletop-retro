import { playerAccess } from "@/lib/player-access";
import { chatHistory } from "@/lib/table-chat";
import { chatEventStream } from "@/lib/table-events";

/** No seat, no feed. */
export async function GET(request: Request, ctx: RouteContext<"/play/[code]/chat">) {
  const { table, seat } = await playerAccess((await ctx.params).code);
  if (!table || !seat) return new Response(null, { status: 403 });
  return chatEventStream(request, table.id, () => chatHistory(table.id));
}
