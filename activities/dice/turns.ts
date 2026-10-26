/**
 * Pure reducers shared by the server and the Table Lead's rehearsal screen.
 * Ids: seat ids at a table, character ids rehearsing.
 */

export type DiceTurn = {
  holders: string[];
  rolls: Record<string, number>;
  /** The latest roll; `who` is null for a roll nobody was holding the dice for; `at` (ms) tells rolls apart. */
  last: { who: string | null; value: number; at: number } | null;
};

export const NO_TURN: DiceTurn = { holders: [], rolls: {}, last: null };

export function nextRoller(turn: DiceTurn): string | null {
  return turn.holders.find((id) => turn.rolls[id] === undefined) ?? null;
}

export function toggleHolder(turn: DiceTurn, id: string): DiceTurn {
  const holders = turn.holders.includes(id) ? turn.holders.filter((h) => h !== id) : [...turn.holders, id];
  return { ...turn, holders };
}

export function soleHolder(turn: DiceTurn, id: string): DiceTurn {
  return { ...turn, holders: [id] };
}

/** A stage roll counts for the next holder who hasn't rolled; otherwise it's a free roll. */
export function stageRoll(turn: DiceTurn, value: number, at: number): DiceTurn {
  const who = nextRoller(turn);
  const last = { who, value, at };
  return who ? { ...turn, rolls: { ...turn.rolls, [who]: value }, last } : { ...turn, last };
}

export function holderRoll(turn: DiceTurn, id: string, value: number, at: number): DiceTurn | null {
  if (!turn.holders.includes(id) || turn.rolls[id] !== undefined) return null;
  return { ...turn, rolls: { ...turn.rolls, [id]: value }, last: { who: id, value, at } };
}

export function randomHolder(ids: readonly string[], turn: DiceTurn): string | null {
  const waiting = ids.filter((id) => turn.rolls[id] === undefined);
  const pool = waiting.length > 0 ? waiting : ids.filter((id) => !turn.holders.includes(id));
  const from = pool.length > 0 ? pool : ids;
  return from.length > 0 ? from[Math.floor(Math.random() * from.length)] : null;
}

export const isRoll = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 20;
