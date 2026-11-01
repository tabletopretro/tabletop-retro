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

/** The seeded example: ids fixed in db/seed.mjs so "Open the example retro" can find it. */
const EXAMPLE = { userId: "user-ada", campaignId: "campaign-example-retro" };

/** The example campaign and its owner, when the seed has run; null otherwise. */
export function exampleRetro() {
  assertLocalSignIn();
  const row = db
    .select({ id: schema.campaigns.id, ownerId: schema.campaigns.ownerId })
    .from(schema.campaigns)
    .where(and(eq(schema.campaigns.id, EXAMPLE.campaignId), eq(schema.campaigns.ownerId, EXAMPLE.userId)))
    .get();
  return row && isLocalUser(row.ownerId) ? row : null;
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
    // New local users join the first team so they see its tables.
    const team = tx
      .select({ id: schema.teams.id })
      .from(schema.teams)
      .orderBy(asc(schema.teams.createdAt))
      .get();
    if (team) {
      tx.insert(schema.memberships)
        .values({ teamId: team.id, userId: user.id })
        .run();
    }
    return user.id;
  });
}
