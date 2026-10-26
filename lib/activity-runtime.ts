import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { activityTimer } from "@/activities";
import { findActivityServer } from "@/activities/server";
import type { ActivityConfig, ActivityFeed, ActivityResult, ActivityStore, ServerContext } from "@/activities/types";
import { publishTable } from "./table-events";
import { activityOnSlide, listSeats, liveState, playerState, updateLive, type LiveState } from "./tables";

/**
 * The framework owns the timer, `shown`, and per-slide state and responses; the rest is the
 * activity's server entry.
 */

/** A moment's grace for input sent just as the timer runs out. */
const GRACE_MS = 1500;

function current(tableId: string) {
  const row = db
    .select({ slide: schema.tables.currentSlide, snapshot: schema.tables.snapshot, state: schema.tables.state })
    .from(schema.tables)
    .where(eq(schema.tables.id, tableId))
    .get();
  if (!row || row.state === "closed" || !row.slide) return null;
  const config = activityOnSlide(row.snapshot, row.slide);
  if (!config) return null;
  return { slide: row.slide, config, live: liveState(tableId) };
}

function timerOf(config: ActivityConfig, live: LiveState, slide: string) {
  const total = activityTimer(config);
  if (total <= 0) return null;
  const started = live.timers?.[slide];
  if (started === undefined) return { total, remainingMs: total * 1000, running: false };
  return { total, remainingMs: Math.max(0, started + total * 1000 - Date.now()), running: true };
}

function isLocked(config: ActivityConfig, live: LiveState, slide: string, grace = 0) {
  const total = activityTimer(config);
  const started = live.timers?.[slide];
  return total > 0 && started !== undefined && Date.now() > started + total * 1000 + grace;
}

function storeFor(tableId: string, slide: string): ActivityStore {
  const where = and(eq(schema.tableResponses.tableId, tableId), eq(schema.tableResponses.slide, slide));
  return {
    rows: () =>
      db
        .select({
          id: schema.tableResponses.id,
          seatId: schema.tableResponses.seatId,
          answer: schema.tableResponses.answer,
          choice: schema.tableResponses.choice,
          createdAt: schema.tableResponses.createdAt,
        })
        .from(schema.tableResponses)
        .where(where)
        .orderBy(asc(schema.tableResponses.createdAt))
        .all(),
    insert: (values) => {
      db.insert(schema.tableResponses)
        .values({ tableId, slide, seatId: values.seatId, answer: values.answer ?? null, choice: values.choice ?? null })
        .run();
      publishTable(tableId);
    },
    update: (id, values) => {
      // Only this slide's rows, whatever id is passed.
      db.update(schema.tableResponses).set(values).where(and(where, eq(schema.tableResponses.id, id))).run();
      publishTable(tableId);
    },
    remove: (id) => {
      db.delete(schema.tableResponses).where(and(where, eq(schema.tableResponses.id, id))).run();
      publishTable(tableId);
    },
    // better-sqlite3 is synchronous and one connection, so the callback can use `db` directly.
    transaction: (work) => db.transaction(() => work()),
  };
}

function contextFor(tableId: string, now: NonNullable<ReturnType<typeof current>>): ServerContext {
  const { slide, config, live } = now;
  return {
    tableId,
    slide,
    config,
    locked: isLocked(config, live, slide, GRACE_MS),
    seats: listSeats(tableId),
    state: <S>() => (liveState(tableId).activities?.[slide] as S | undefined) ?? null,
    setState: (next) =>
      updateLive(tableId, (l) => ({ ...l, activities: { ...l.activities, [slide]: next } })),
    store: storeFor(tableId, slide),
    publish: () => publishTable(tableId),
  };
}

function feedOf(tableId: string, now: NonNullable<ReturnType<typeof current>>, seatId: string | null): ActivityFeed {
  const { slide, config, live } = now;
  const shown = live.shown?.includes(slide) ?? false;
  const server = findActivityServer(config.type);
  const view = server ? server.view(contextFor(tableId, now), seatId, shown) : { answered: 0, data: null };
  return {
    slide,
    type: config.type,
    shown,
    timer: timerOf(config, live, slide),
    locked: isLocked(config, live, slide),
    answered: view.answered,
    data: view.data,
  };
}

export function leadActivity(tableId: string): ActivityFeed | null {
  const now = current(tableId);
  return now ? feedOf(tableId, now, null) : null;
}

/** A seat the Table Lead removed is told so, rather than seeing a closed table. */
export function playerView(tableId: string, seatId: string) {
  const state = playerState(tableId);
  if (!state.open) return state;
  const seat = db.select({ id: schema.seats.id }).from(schema.seats).where(eq(schema.seats.id, seatId)).get();
  if (!seat) return { open: true as const, removed: true as const };
  const now = current(tableId);
  return { ...state, activity: now ? feedOf(tableId, now, seatId) : null };
}

const ACTION_PATTERN = /^[a-z][a-z0-9-]{0,30}$/;

/** Own handlers only, so an action named like `constructor` finds nothing. */
function ownHandler<H>(handlers: Record<string, H> | undefined, action: string): H | null {
  return handlers && Object.hasOwn(handlers, action) ? handlers[action] : null;
}

function onSlide(tableId: string, slide: unknown) {
  const now = current(tableId);
  if (!now || now.slide !== slide) return { error: "This page has moved on" } as const;
  return now;
}

export function runPlayerAction(tableId: string, seatId: string, slide: unknown, action: unknown, payload: unknown): ActivityResult {
  const now = onSlide(tableId, slide);
  if ("error" in now) return { ok: false, error: now.error };
  const handler = typeof action === "string" && ACTION_PATTERN.test(action) ? ownHandler(findActivityServer(now.config.type)?.player, action) : null;
  if (!handler) return { ok: false, error: "That isn't something you can do here" };
  return handler(contextFor(tableId, now), seatId, payload);
}

export function runLeadAction(tableId: string, slide: unknown, action: unknown, payload: unknown): ActivityResult {
  const now = onSlide(tableId, slide);
  if ("error" in now) return { ok: false, error: now.error };
  const handler = typeof action === "string" && ACTION_PATTERN.test(action) ? ownHandler(findActivityServer(now.config.type)?.lead, action) : null;
  if (!handler) return { ok: false, error: "That isn't something you can do here" };
  return handler(contextFor(tableId, now), payload);
}

export function setShown(tableId: string, slide: string, shown: boolean) {
  updateLive(tableId, (live) => {
    const rest = (live.shown ?? []).filter((s) => s !== slide);
    return { ...live, shown: shown ? [...rest, slide] : rest };
  });
}

export function restartTimer(tableId: string, slide: string) {
  updateLive(tableId, (live) => ({ ...live, timers: { ...live.timers, [slide]: Date.now() } }));
}
