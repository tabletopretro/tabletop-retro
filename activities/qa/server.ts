import "server-only";
import { defineActivityServer, type ActivityResult, type ServerContext } from "../types";
import { QA_ANSWER_MAX, type QaAnswer, type QaConfig, type QaData } from "./definition";

/*
 * Anonymous pages never send seats, and their answers come in a fixed shuffled order
 * so the order can't identify anyone.
 */

/** Plenty for a retro; stops a stuck key from filling the table. */
const ANSWERS_PER_SEAT = 20;
const ID_PATTERN = /^[0-9a-f-]{36}$/;

/** Whitespace runs inside a line collapse; up to two line breaks in a row survive. */
function clean(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\r\n?/g, "\n").replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function checkAnswer(raw: unknown): string | { error: string } {
  const answer = clean(raw);
  if (!answer) return { error: "Write something first" };
  if (answer.length > QA_ANSWER_MAX) return { error: `Answers can be up to ${QA_ANSWER_MAX} characters` };
  return answer;
}

function answersOf(ctx: ServerContext<QaConfig>): QaAnswer[] {
  const rows = ctx.store.rows().filter((r) => r.answer !== null);
  // Anonymous: ids are random, so sorting by them is a stable shuffle.
  const ordered = ctx.config.anonymous ? [...rows].sort((a, b) => a.id.localeCompare(b.id)) : rows;
  return ordered.map((r) => ({ id: r.id, seatId: ctx.config.anonymous ? null : r.seatId, answer: r.answer ?? "" }));
}

const payload = (raw: unknown) => (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {});

/** Only the player's own rows, whatever id is passed. */
function own(ctx: ServerContext<QaConfig>, seatId: string, id: unknown) {
  if (typeof id !== "string" || !ID_PATTERN.test(id)) return null;
  return ctx.store.rows().find((r) => r.id === id && r.seatId === seatId) ?? null;
}

const locked = (ctx: ServerContext<QaConfig>): ActivityResult | null => (ctx.locked ? { ok: false, error: "Time's up" } : null);

export const qaServer = defineActivityServer<QaConfig, QaData>({
  view: (ctx, seatId, shown) => {
    const rows = ctx.store.rows();
    const sees = seatId === null || shown;
    return {
      answered: new Set(rows.map((r) => r.seatId)).size,
      data: {
        answers: sees ? answersOf(ctx) : null,
        mine: seatId ? rows.filter((r) => r.seatId === seatId && r.answer !== null).map((r) => ({ id: r.id, answer: r.answer ?? "" })) : [],
      },
    };
  },
  player: {
    add: (ctx, seatId, raw) => {
      const stop = locked(ctx);
      if (stop) return stop;
      const answer = checkAnswer(payload(raw).answer);
      if (typeof answer !== "string") return { ok: false, error: answer.error };
      const mine = ctx.store.rows().filter((r) => r.seatId === seatId).length;
      if (mine >= ANSWERS_PER_SEAT) return { ok: false, error: `Up to ${ANSWERS_PER_SEAT} answers each` };
      ctx.store.insert({ seatId, answer });
      return { ok: true };
    },
    edit: (ctx, seatId, raw) => {
      const stop = locked(ctx);
      if (stop) return stop;
      const row = own(ctx, seatId, payload(raw).id);
      if (!row) return { ok: false, error: "That answer's gone" };
      const answer = checkAnswer(payload(raw).answer);
      if (typeof answer !== "string") return { ok: false, error: answer.error };
      ctx.store.update(row.id, { answer });
      return { ok: true };
    },
    remove: (ctx, seatId, raw) => {
      const stop = locked(ctx);
      if (stop) return stop;
      const row = own(ctx, seatId, payload(raw).id);
      if (row) ctx.store.remove(row.id);
      return { ok: true };
    },
  },
});
