import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./config";

/** The cookie holds a random 256-bit token; only its SHA-256 is stored, so a copied DB can't be replayed. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function createSession(userId: string) {
  // A fresh token on every sign-in; any session this browser held dies.
  await deleteSession();
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date())).run();

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.insert(schema.sessions)
    .values({ id: hashSessionToken(token), userId, expiresAt })
    .run();

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const token = await readSessionToken();
  if (token) {
    db.delete(schema.sessions)
      .where(eq(schema.sessions.id, hashSessionToken(token)))
      .run();
  }
  (await cookies()).delete(SESSION_COOKIE);
}
