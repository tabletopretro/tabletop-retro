import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cleanGuestName, foldName, uniqueGuestName } from "./guest-name";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ActivityConfig } from "@/activities/types";
import { activityTimer } from "@/activities";
import { docImages, docSounds, docVideos, type CampaignDoc } from "./campaign-doc";
import type { Character } from "./character-doc";
import { generateTableCode, TABLE_CODE_PATTERN } from "./table-code";
import { publishTable } from "./table-events";

/** Every function takes ids the caller has already checked (owner for TL calls, seat for player calls). */

/** Seats per table, counting everyone who ever sat down; a retro is a handful of people. */
export const MAX_SEATS = 50;
export const seatCookieName = (tableId: string) => `tr_seat_${tableId}`;

/** What players get: the doc and the cast, minus anything TL-only. */
export type TableSnapshot = {
  version: 1;
  /** When this copy was taken (ms): players refetch when it changes. */
  savedAt: number;
  doc: CampaignDoc;
  cast: Character[];
};

export function snapshotOf(doc: CampaignDoc, cast: readonly Character[]): TableSnapshot {
  return {
    version: 1,
    savedAt: Date.now(),
    // Notes, page names and chapter titles are the TL's labels.
    doc: {
      ...doc,
      chapters: doc.chapters.map((c) => ({
        ...c,
        title: "",
        opener: c.opener ? { ...c.opener, notes: "" } : null,
        pages: c.pages.map((p) => ({ ...p, title: "", notes: "" })),
      })),
    },
    // Players get names; notes, portraits, artwork and fields stay owner-only.
    cast: cast.map((c) => ({ ...c, notes: "", portrait: null, artwork: null, fields: [], campaigns: [] })),
  };
}

/** The campaign's code, claiming one on first use. Collisions just roll again. */
export function campaignCode(campaignId: string): string {
  const row = db
    .select({ code: schema.campaigns.tableCode })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.id, campaignId))
    .get();
  if (row?.code) return row.code;
  return claimCode(campaignId);
}

function claimCode(campaignId: string): string {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateTableCode();
    try {
      // The unique index is the check: one query, no lookup per roll.
      db.update(schema.campaigns).set({ tableCode: code }).where(eq(schema.campaigns.id, campaignId)).run();
      return code;
    } catch (error) {
      if (!String(error).includes("UNIQUE")) throw error;
    }
  }
  throw new Error("Couldn't claim a table code");
}

export type NewCodeResult = { code: string } | { error: "table-open" };

/** A fresh code, retiring the old one. Refused while the table is open, so nobody's locked out mid-session. */
export function newCampaignCode(campaignId: string): NewCodeResult {
  if (liveTable(campaignId)) return { error: "table-open" };
  return { code: claimCode(campaignId) };
}

export function liveTable(campaignId: string) {
  return (
    db
      .select()
      .from(schema.tables)
      .where(and(eq(schema.tables.campaignId, campaignId), ne(schema.tables.state, "closed")))
      .get() ?? null
  );
}

/** Returns the table already live, if any, rather than opening a second. */
export function openTable(campaignId: string, tlUserId: string, snapshot: TableSnapshot, slide: string | null) {
  const existing = liveTable(campaignId);
  if (existing) return existing;
  return db
    .insert(schema.tables)
    .values({
      code: campaignCode(campaignId),
      campaignId,
      tlUserId,
      state: "open",
      snapshot,
      currentSlide: slide,
    })
    .returning()
    .get();
}

/**
 * What's live at the table besides the slide: which pages' results the
 * Table Lead has put on screen (`shown`), when each timed page's timer
 * started (`timers`, server ms by slide), and each activity's own state
 * by slide (`activities`, whatever its server entry keeps there).
 */
export type LiveState = {
  shown?: string[];
  timers?: Record<string, number>;
  activities?: Record<string, unknown>;
};

export function liveState(tableId: string): LiveState {
  const row = db.select({ live: schema.tables.liveState }).from(schema.tables).where(eq(schema.tables.id, tableId)).get();
  const live = row?.live;
  return live && typeof live === "object" ? (live as LiveState) : {};
}

/** Read-modify-write with no transaction: better-sqlite3 is synchronous, so nothing interleaves. */
export function updateLive(tableId: string, change: (live: LiveState) => LiveState) {
  const next = change(liveState(tableId));
  db.update(schema.tables).set({ liveState: next }).where(eq(schema.tables.id, tableId)).run();
  publishTable(tableId);
}

export function activityOnSlide(snapshot: unknown, slide: string | null): ActivityConfig | null {
  const doc = (snapshot as Partial<TableSnapshot> | null)?.doc;
  if (!doc || !slide) return null;
  for (const chapter of doc.chapters) {
    const page = chapter.pages.find((p) => p.id === slide);
    if (page) return page.kind === "activity" ? page.activity : null;
  }
  return null;
}

export function refreshSnapshot(tableId: string, snapshot: TableSnapshot) {
  db.update(schema.tables).set({ snapshot }).where(eq(schema.tables.id, tableId)).run();
  publishTable(tableId);
}

export function closeTable(tableId: string) {
  db.update(schema.tables)
    .set({ state: "closed", closedAt: new Date() })
    .where(eq(schema.tables.id, tableId))
    .run();
  publishTable(tableId);
}

/** Where the TL's video is: playing or paused, at `position` seconds as of `at` (server ms). */
export type Playback = { slide: string; playing: boolean; position: number; at: number };

export function setPlayback(tableId: string, playback: Omit<Playback, "at">) {
  db.update(schema.tables)
    .set({ playback: { ...playback, at: Date.now() } })
    .where(eq(schema.tables.id, tableId))
    .run();
  publishTable(tableId);
}

/**
 * The playback players should be at right now: a playing video's position
 * moves on by the time since it was set, worked out here on the server so
 * players' clocks don't matter.
 */
export function playbackNow(raw: unknown): (Omit<Playback, "at"> & { position: number }) | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Playback;
  if (typeof p.slide !== "string" || typeof p.position !== "number" || typeof p.at !== "number") return null;
  const position = p.playing ? p.position + (Date.now() - p.at) / 1000 : p.position;
  return { slide: p.slide, playing: p.playing === true, position };
}

/** A timed activity's timer starts the first time its slide comes up; coming back doesn't restart it. */
export function setCurrentSlide(tableId: string, slide: string | null) {
  db.update(schema.tables).set({ currentSlide: slide }).where(eq(schema.tables.id, tableId)).run();
  const row = db.select({ snapshot: schema.tables.snapshot }).from(schema.tables).where(eq(schema.tables.id, tableId)).get();
  const activity = activityOnSlide(row?.snapshot, slide);
  const timed = slide && activity && activityTimer(activity) > 0;
  if (timed && liveState(tableId).timers?.[slide] === undefined) {
    updateLive(tableId, (live) => ({ ...live, timers: { ...live.timers, [slide]: Date.now() } }));
    return;
  }
  publishTable(tableId);
}

export function liveTableByCode(code: string) {
  if (!TABLE_CODE_PATTERN.test(code)) return null;
  return (
    db
      .select({
        id: schema.tables.id,
        code: schema.tables.code,
        state: schema.tables.state,
        campaignId: schema.tables.campaignId,
        currentSlide: schema.tables.currentSlide,
        playback: schema.tables.playback,
        liveState: schema.tables.liveState,
        snapshot: schema.tables.snapshot,
        title: schema.campaigns.title,
      })
      .from(schema.tables)
      .innerJoin(schema.campaigns, eq(schema.campaigns.id, schema.tables.campaignId))
      .where(and(eq(schema.tables.code, code), ne(schema.tables.state, "closed")))
      .get() ?? null
  );
}

/** Media a live table's snapshot uses, so the TL's saves never prune what players are shown. */
export function liveTableMedia(campaignId: string): string[] {
  const table = liveTable(campaignId);
  const snapshot = table?.snapshot as TableSnapshot | undefined;
  return snapshot?.doc ? [...docImages(snapshot.doc), ...docVideos(snapshot.doc), ...docSounds(snapshot.doc)] : [];
}

export function seatForUser(tableId: string, userId: string) {
  return (
    db
      .select()
      .from(schema.seats)
      .where(and(eq(schema.seats.tableId, tableId), eq(schema.seats.userId, userId)))
      .get() ?? null
  );
}

const hashGuestKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** A guest's seat by the key in their cookie; anything else is null. */
export function seatByGuestKey(tableId: string, key: string | undefined) {
  if (!key || !/^[A-Za-z0-9_-]{43}$/.test(key)) return null;
  return (
    db
      .select()
      .from(schema.seats)
      .where(
        and(eq(schema.seats.tableId, tableId), isNull(schema.seats.userId), eq(schema.seats.guestKeyHash, hashGuestKey(key))),
      )
      .get() ?? null
  );
}

export function seatCount(tableId: string): number {
  return db.select({ id: schema.seats.id }).from(schema.seats).where(eq(schema.seats.tableId, tableId)).all().length;
}

/** A guest's name as the table will show it (lib/guest-name.ts), made unique at this table. */
export function guestNameFor(tableId: string, raw: string): { name: string } | { error: string } {
  const leadName =
    db
      .select({ name: schema.users.name })
      .from(schema.tables)
      .innerJoin(schema.users, eq(schema.users.id, schema.tables.tlUserId))
      .where(eq(schema.tables.id, tableId))
      .get()?.name ?? null;
  const cleaned = cleanGuestName(raw, leadName);
  if ("error" in cleaned) return cleaned;
  return { name: uniqueGuestName(cleaned.name, new Set(listSeats(tableId).map((s) => foldName(s.name)))) };
}

export function createSeat(tableId: string, who: { userId: string }): void;
/** Returns the guest's seat key, for their cookie only. */
export function createSeat(tableId: string, who: { guestName: string }): string;
export function createSeat(tableId: string, who: { userId: string } | { guestName: string }) {
  const key = "guestName" in who ? randomBytes(32).toString("base64url") : null;
  db.insert(schema.seats)
    .values({ tableId, ...who, guestKeyHash: key ? hashGuestKey(key) : null })
    .run();
  publishTable(tableId);
  return key ?? undefined;
}

export function playerState(tableId: string) {
  const row = db
    .select({
      state: schema.tables.state,
      slide: schema.tables.currentSlide,
      playback: schema.tables.playback,
      snapshot: schema.tables.snapshot,
    })
    .from(schema.tables)
    .where(eq(schema.tables.id, tableId))
    .get();
  if (!row || row.state === "closed") return { open: false as const };
  return {
    open: true as const,
    seats: listSeats(tableId),
    slide: row.slide,
    playback: playbackNow(row.playback),
    // Just the version: the snapshot itself is fetched only when it changes.
    snapshotAt: (row.snapshot as Partial<TableSnapshot> | null)?.savedAt ?? 0,
  };
}

export type SeatInfo = { id: string; name: string; characterId: string | null };

export function listSeats(tableId: string): SeatInfo[] {
  return db
    .select({
      id: schema.seats.id,
      guestName: schema.seats.guestName,
      userName: schema.users.name,
      characterId: schema.seats.characterId,
    })
    .from(schema.seats)
    .leftJoin(schema.users, eq(schema.users.id, schema.seats.userId))
    .where(eq(schema.seats.tableId, tableId))
    .orderBy(schema.seats.joinedAt)
    .all()
    .map((s) => ({ id: s.id, name: s.userName ?? s.guestName ?? "Player", characterId: s.characterId }));
}

/**
 * One seat per character: refused when someone else holds it. The caller
 * has checked the character is in the cast. Only a seat at this table
 * changes, whatever id is passed.
 */
export function setSeatCharacter(tableId: string, seatId: string, characterId: string | null): "ok" | "taken" {
  const result = db.transaction((tx) => {
    if (characterId) {
      const holder = tx
        .select({ id: schema.seats.id })
        .from(schema.seats)
        .where(and(eq(schema.seats.tableId, tableId), eq(schema.seats.characterId, characterId)))
        .get();
      if (holder && holder.id !== seatId) return "taken" as const;
    }
    tx.update(schema.seats)
      .set({ characterId })
      .where(and(eq(schema.seats.id, seatId), eq(schema.seats.tableId, tableId)))
      .run();
    return "ok" as const;
  });
  if (result === "ok") publishTable(tableId);
  return result;
}

/** The seat's answers go with it (cascade); chat messages stay under the name they had. Only a seat at this table, whatever id is passed. */
export function removeSeat(tableId: string, seatId: string) {
  db.delete(schema.seats)
    .where(and(eq(schema.seats.id, seatId), eq(schema.seats.tableId, tableId)))
    .run();
  publishTable(tableId);
}
