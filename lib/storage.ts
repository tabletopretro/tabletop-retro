import "server-only";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { CONTENT_DIR, db, schema } from "@/db";

/**
 * Each owner's campaign and character files share one budget, so one
 * account can't fill the volume. Checked before every upload; the stream
 * cap is lowered to what's left so an undeclared length can't slip past.
 */
export const STORAGE_PER_OWNER_BYTES = Math.max(1, Number(process.env.STORAGE_PER_OWNER_MB) || 2048) * 1024 * 1024;

export const STORAGE_FULL = `Storage for your campaigns is full (${Math.round(STORAGE_PER_OWNER_BYTES / 1024 / 1024 / 1024 * 10) / 10} GB)`;

function folderBytes(dir: string): number {
  let total = 0;
  let entries: import("node:fs").Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += folderBytes(full);
    else if (entry.isFile()) {
      try {
        total += statSync(full).size;
      } catch {
        // Pruned between readdir and stat.
      }
    }
  }
  return total;
}

export function ownerUsageBytes(ownerId: string): number {
  const campaigns = db
    .select({ contentPath: schema.campaigns.contentPath })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.ownerId, ownerId))
    .all();
  const characters = db
    .select({ id: schema.characters.id })
    .from(schema.characters)
    .where(eq(schema.characters.ownerId, ownerId))
    .all();
  let total = 0;
  for (const c of campaigns) total += folderBytes(path.join(CONTENT_DIR, "campaigns", c.contentPath));
  for (const c of characters) total += folderBytes(path.join(CONTENT_DIR, "characters", c.id));
  return total;
}

export function storageLeft(ownerId: string): number {
  return Math.max(0, STORAGE_PER_OWNER_BYTES - ownerUsageBytes(ownerId));
}
