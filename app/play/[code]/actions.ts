"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { playerAccess } from "@/lib/player-access";
import type { ActivityResult } from "@/activities/types";
import { runPlayerAction } from "@/lib/activity-runtime";
import { NOT_OPEN } from "@/lib/not-open";
import { allow, clientKey } from "@/lib/rate-limit";
import { postChat, type PostChatResult } from "@/lib/table-chat";
import {
  createSeat,
  guestNameFor,
  MAX_SEATS,
  seatCookieName,
  seatCount,
  setSeatCharacter,
  type TableSnapshot,
} from "@/lib/tables";

export type SeatState = { error: string | null };

/**
 * Every export here is a public endpoint: the code and payloads are untrusted.
 * Guests are let back in by a secret seat key in an HttpOnly cookie scoped to /play.
 */
export async function takeSeatAction(rawCode: string, _prev: SeatState, formData: FormData): Promise<SeatState> {
  const { code, table, seat, user } = await playerAccess(rawCode);
  if (!code || !table) return { error: NOT_OPEN };
  if (seat) redirect(`/play/${code}`);
  // Seats are cheap to ask for and never expire, so cap them per table and per network.
  if (!allow(`seat:${clientKey(await headers())}`, 12, 10 * 60_000)) {
    return { error: "Too many seats taken from your network just now; try again in a few minutes" };
  }
  if (seatCount(table.id) >= MAX_SEATS) return { error: "This table is full" };

  if (user) {
    createSeat(table.id, { userId: user.id });
  } else {
    const named = guestNameFor(table.id, String(formData.get("name") ?? ""));
    if ("error" in named) return { error: named.error };
    const key = createSeat(table.id, { guestName: named.name });
    (await cookies()).set(seatCookieName(table.id), key, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/play",
      maxAge: 60 * 60 * 24,
    });
  }
  redirect(`/play/${code}`);
}

export type PickState = { ok: true } | { ok: false; error: string };

/** `null` lets the character go. A character someone else holds is refused. */
export async function pickCharacterAction(rawCode: string, characterId: unknown): Promise<PickState> {
  const { table, seat } = await playerAccess(rawCode);
  if (!table || !seat) return { ok: false, error: "Take a seat first" };
  if (characterId !== null) {
    const cast = (table.snapshot as TableSnapshot).cast ?? [];
    if (typeof characterId !== "string" || !cast.some((c) => c.id === characterId)) {
      return { ok: false, error: "That character isn't in this campaign" };
    }
  }
  const result = setSeatCharacter(table.id, seat.id, characterId);
  return result === "ok" ? { ok: true } : { ok: false, error: "Someone else just took them" };
}

export async function sendChatAction(rawCode: string, body: unknown): Promise<PostChatResult> {
  const { table, seat, user } = await playerAccess(rawCode);
  if (!table || !seat) return { ok: false, error: "Take a seat first" };
  return postChat(table.id, { seatId: seat.id, name: user?.name ?? seat.guestName ?? "Player" }, body);
}

/**
 * Runs one of the current activity's `player` handlers (activities/server.ts).
 * This only checks the seat; the runtime checks the slide is the one on screen
 * and the handler treats the payload as hostile.
 */
export async function activityAction(rawCode: string, slide: unknown, action: unknown, payload: unknown): Promise<ActivityResult> {
  const { table, seat } = await playerAccess(rawCode);
  if (!table || !seat) return { ok: false, error: "Take a seat first" };
  return runPlayerAction(table.id, seat.id, slide, action, payload);
}
