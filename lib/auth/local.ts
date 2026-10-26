import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { LOCAL_SIGN_IN_ENABLED } from "./config";

/** No-password sign-in: every export refuses to run outside `next dev`. */
function assertLocalSignIn() {
  if (!LOCAL_SIGN_IN_ENABLED) {
    throw new Error("Local sign-in only exists under next dev.");
  }
}

export function listLocalUsers() {
  assertLocalSignIn();
  return db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.accounts)
    .innerJoin(schema.users, eq(schema.users.id, schema.accounts.userId))
    .where(eq(schema.accounts.provider, "local"))
    .orderBy(asc(schema.users.name))
    .all();
}

export function isLocalUser(userId: string): boolean {
  assertLocalSignIn();
  return Boolean(
    db
      .select({ userId: schema.accounts.userId })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.provider, "local"),
          eq(schema.accounts.userId, userId),
        ),
      )
      .get(),
  );
}

export function createLocalUser(name: string): string {
  assertLocalSignIn();
  return db.transaction((tx) => {
    const user = tx
      .insert(schema.users)
      .values({ name })
      .returning({ id: schema.users.id })
      .get();
    tx.insert(schema.accounts)
      .values({ provider: "local", providerAccountId: user.id, userId: user.id })
      .run();
    return user.id;
  });
}
