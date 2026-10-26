import "server-only";
import { randomInt } from "node:crypto";
import { defineActivityServer, type ActivityResult, type ServerContext } from "../types";
import type { DiceConfig } from "./definition";
import { holderRoll, isRoll, NO_TURN, soleHolder, stageRoll, toggleHolder, type DiceTurn } from "./turns";

/* Ids are seat ids, checked against the table; payloads are untrusted. */

const turnOf = (ctx: ServerContext<DiceConfig>) => ctx.state<DiceTurn>() ?? NO_TURN;

function seatOf(ctx: ServerContext<DiceConfig>, raw: unknown): string | null {
  const id = (raw as { id?: unknown } | null)?.id;
  return typeof id === "string" && ctx.seats.some((s) => s.id === id) ? id : null;
}

const set = (ctx: ServerContext<DiceConfig>, turn: DiceTurn): ActivityResult => {
  ctx.setState(turn);
  return { ok: true };
};

export const diceServer = defineActivityServer<DiceConfig, DiceTurn | null>({
  view: (ctx) => {
    const turn = ctx.state<DiceTurn>();
    return { answered: turn ? Object.keys(turn.rolls).length : 0, data: turn };
  },
  lead: {
    toggle: (ctx, raw) => {
      const id = seatOf(ctx, raw);
      return id ? set(ctx, toggleHolder(turnOf(ctx), id)) : { ok: false, error: "They've left the table" };
    },
    random: (ctx, raw) => {
      const id = seatOf(ctx, raw);
      return id ? set(ctx, soleHolder(turnOf(ctx), id)) : { ok: false, error: "They've left the table" };
    },
    clear: (ctx) => set(ctx, NO_TURN),
    rolled: (ctx, raw) => {
      const value = (raw as { value?: unknown } | null)?.value;
      return isRoll(value) ? set(ctx, stageRoll(turnOf(ctx), value, Date.now())) : { ok: false, error: "That isn't a roll" };
    },
  },
  player: {
    // The number is the server's, never the browser's: the player's die replays it from the feed.
    roll: (ctx, seatId) => {
      const next = holderRoll(turnOf(ctx), seatId, randomInt(1, 21), Date.now());
      return next ? set(ctx, next) : { ok: false, error: "The dice aren't yours right now" };
    },
  },
});
