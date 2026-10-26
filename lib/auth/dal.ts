import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import { hashSessionToken, readSessionToken } from "./session";

export type CurrentUser = { id: string; name: string; avatarUrl: string | null };

/** The real auth check (proxy only looks for the cookie). Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const row = db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.id, hashSessionToken(token)),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .get();

  return row ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
