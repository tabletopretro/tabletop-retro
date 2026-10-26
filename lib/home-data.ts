import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";

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
