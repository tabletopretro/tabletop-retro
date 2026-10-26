import "server-only";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/** Reused across dev hot reloads so HMR doesn't leak file handles. */
declare global {
  var __tabletopRetroSqlite: Database.Database | undefined;
}

export const DB_PATH = process.env.DATABASE_PATH ?? "dev.db";
/** Campaign and character files; they pair with the database, so keep both on the same volume. */
export const CONTENT_DIR = process.env.CONTENT_DIR ?? path.join(process.cwd(), "content");

const connection =
  globalThis.__tabletopRetroSqlite ??
  (() => {
    const conn = new Database(DB_PATH);
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    return conn;
  })();

if (process.env.NODE_ENV !== "production") {
  globalThis.__tabletopRetroSqlite = connection;
}

export const db = drizzle(connection, { schema });
export { schema };
