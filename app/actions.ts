"use server";

import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { IN_SESSION, NOT_OPEN } from "@/lib/not-open";
import { allow, clientKey } from "@/lib/rate-limit";
import { TABLE_CODE_EXAMPLE, normalizeTableCode } from "@/lib/table-code";

export type JoinTableState = { error: string | null };

export async function joinTable(
  _prev: JoinTableState,
  formData: FormData,
): Promise<JoinTableState> {
  const code = normalizeTableCode(String(formData.get("code") ?? ""));
  if (!code) return { error: `Codes look like ${TABLE_CODE_EXAMPLE}` };
  // Wrong codes and closed tables answer alike, and slowly enough that guessing one is hopeless.
  if (!allow(`join:${clientKey(await headers())}`, 20, 60_000)) {
    return { error: "Too many tries just now; wait a minute" };
  }

  const table = db
    .select({ state: schema.tables.state, lateSeats: schema.tables.lateSeats })
    .from(schema.tables)
    .where(and(eq(schema.tables.code, code), ne(schema.tables.state, "closed")))
    .get();

  if (!table) return { error: NOT_OPEN };
  // Someone already seated gets back in through /play/[code] regardless; this only stops new seats.
  if (table.state === "in_session" && !table.lateSeats) return { error: IN_SESSION };

  redirect(`/play/${code}`);
}
