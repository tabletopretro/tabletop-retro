import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

/** Live tables on any team the user belongs to; no screen lists these yet. */
export function tablesForUser(userId: string) {
  const teamIds = db
    .select({ id: schema.memberships.teamId })
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userId));

  return db
    .select({
      code: schema.tables.code,
      state: schema.tables.state,
      campaignTitle: schema.campaigns.title,
      tlName: schema.users.name,
    })
    .from(schema.tables)
    .innerJoin(schema.campaigns, eq(schema.campaigns.id, schema.tables.campaignId))
    .innerJoin(schema.users, eq(schema.users.id, schema.tables.tlUserId))
    .where(
      and(
        inArray(schema.tables.teamId, teamIds),
        inArray(schema.tables.state, ["open", "in_session"]),
      ),
    )
    .orderBy(desc(schema.tables.openedAt))
    .all();
}

export function campaignsForOwner(userId: string) {
  return db
    .select({
      id: schema.campaigns.id,
      title: schema.campaigns.title,
      updatedAt: schema.campaigns.updatedAt,
    })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.ownerId, userId))
    .orderBy(desc(schema.campaigns.updatedAt))
    .all();
}
