import type { LiveActivity, LocalState, TableLink } from "../types";
import { NO_TURN, soleHolder, stageRoll, toggleHolder, type DiceTurn } from "./turns";

/** Table open: the feed's turn and the server's `lead` handlers; rehearsing: local state, same reducers. */
export function turnLink(feed: LiveActivity<DiceTurn | null> | null, table: TableLink | null, local: LocalState) {
  const turn: DiceTurn = table ? (feed?.data ?? NO_TURN) : ((local.value as DiceTurn | null) ?? NO_TURN);
  const send = (action: string, payload: unknown, reduce: (turn: DiceTurn) => DiceTurn) => {
    if (table) table.lead(action, payload).catch(() => undefined);
    else local.set(reduce(turn));
  };
  return {
    turn,
    toggle: (id: string) => send("toggle", { id }, (t) => toggleHolder(t, id)),
    random: (id: string) => send("random", { id }, (t) => soleHolder(t, id)),
    clear: () => send("clear", undefined, () => NO_TURN),
    rolled: (value: number) => send("rolled", { value }, (t) => stageRoll(t, value, Date.now())),
  };
}
