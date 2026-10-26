import "server-only";
import { defineActivityServer, type ServerContext } from "../types";
import type { VoteConfig, VoteData, VoteTally } from "./definition";

/* Anonymous pages still record the seat (one vote each) but never send it to anyone, the Table Lead included. */

function tallyOf(ctx: ServerContext<VoteConfig>): VoteTally {
  const counts = ctx.config.options.map(() => 0);
  const voters: Record<number, string[]> = {};
  for (const r of ctx.store.rows()) {
    if (r.choice === null || r.choice < 0 || r.choice >= counts.length) continue;
    counts[r.choice] += 1;
    (voters[r.choice] ??= []).push(r.seatId);
  }
  return { counts, voters: ctx.config.anonymous ? null : voters };
}

export const voteServer = defineActivityServer<VoteConfig, VoteData>({
  view: (ctx, seatId, shown) => {
    const rows = ctx.store.rows();
    const sees = seatId === null || shown;
    return {
      answered: new Set(rows.map((r) => r.seatId)).size,
      data: {
        tally: sees ? tallyOf(ctx) : null,
        mine: seatId ? (rows.find((r) => r.seatId === seatId && r.choice !== null)?.choice ?? null) : null,
      },
    };
  },
  player: {
    submit: (ctx, seatId, raw) => {
      if (ctx.locked) return { ok: false, error: "Time's up" };
      const choice = (raw as { choice?: unknown } | null)?.choice;
      if (typeof choice !== "number" || !Number.isInteger(choice) || !ctx.config.options[choice]?.trim()) {
        return { ok: false, error: "Pick one of the options" };
      }
      const done = ctx.store.transaction(() => {
        if (ctx.store.rows().some((r) => r.seatId === seatId)) return false;
        ctx.store.insert({ seatId, choice });
        return true;
      });
      return done ? { ok: true } : { ok: false, error: "You've already voted" };
    },
  },
});
