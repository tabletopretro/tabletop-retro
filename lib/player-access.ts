import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "./auth/dal";
import { normalizeTableCode } from "./table-code";
import { liveTableByCode, seatByGuestKey, seatCookieName, seatForUser } from "./tables";

/** Every player page, action and route starts here. */
export async function playerAccess(rawCode: string) {
  const code = normalizeTableCode(decodeURIComponent(rawCode));
  const table = code ? liveTableByCode(code) : null;
  if (!code || !table) return { code, table: null, seat: null, user: null } as const;
  const user = await getCurrentUser();
  const seat = user
    ? seatForUser(table.id, user.id)
    : seatByGuestKey(table.id, (await cookies()).get(seatCookieName(table.id))?.value);
  return { code, table, seat, user } as const;
}
