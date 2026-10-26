import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { publishChat } from "./table-events";

/** Callers have checked the sender (owner for the TL, a seat for players). */

/** Kept in step with CHAT_MAX_CLIENT in app/play/chat.tsx. */
export const CHAT_MAX = 500;
const HISTORY = 100;
/** The fastest one sender can post, so a stuck key can't flood the table. */
const MIN_GAP_MS = 400;

export type ChatMessage = {
  id: string;
  /** The player's seat; null for the TL's messages. */
  seatId: string | null;
  fromLead: boolean;
  name: string;
  body: string;
  at: number;
};

const toMessage = (row: typeof schema.tableMessages.$inferSelect): ChatMessage => ({
  id: row.id,
  seatId: row.seatId,
  fromLead: row.fromLead,
  name: row.name,
  body: row.body,
  at: row.createdAt.getTime(),
});

export function chatHistory(tableId: string): ChatMessage[] {
  return db
    .select()
    .from(schema.tableMessages)
    .where(eq(schema.tableMessages.tableId, tableId))
    .orderBy(desc(schema.tableMessages.createdAt))
    .limit(HISTORY)
    .all()
    .reverse()
    .map(toMessage);
}

declare global {
  var __tabletopRetroChatLast: Map<string, number> | undefined;
}
const lastSent = (globalThis.__tabletopRetroChatLast ??= new Map<string, number>());

/** Whitespace runs inside a line collapse; up to two line breaks in a row survive. */
export function cleanChatBody(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type PostChatResult = { ok: true } | { ok: false; error: string };

export function postChat(
  tableId: string,
  from: { lead: true; name: string } | { seatId: string; name: string },
  raw: unknown,
): PostChatResult {
  const body = cleanChatBody(raw);
  if (!body) return { ok: false, error: "Say something first" };
  if (body.length > CHAT_MAX) return { ok: false, error: `Messages can be up to ${CHAT_MAX} characters` };
  const sender = "lead" in from ? `lead:${tableId}` : `seat:${from.seatId}`;
  const now = Date.now();
  if (now - (lastSent.get(sender) ?? 0) < MIN_GAP_MS) return { ok: false, error: "Slow down a little" };
  if (lastSent.size > 10_000) lastSent.clear();
  lastSent.set(sender, now);
  let row;
  try {
    row = db
      .insert(schema.tableMessages)
      .values({
        tableId,
        seatId: "lead" in from ? null : from.seatId,
        fromLead: "lead" in from,
        name: from.name,
        body,
      })
      .returning()
      .get();
  } catch (error) {
    // Say what failed rather than letting the action throw, which reads as a network error.
    console.error("Couldn't save a chat message", error);
    return { ok: false, error: "Couldn't save your message" };
  }
  publishChat(tableId, toMessage(row));
  return { ok: true };
}
