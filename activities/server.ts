import "server-only";
import type { AnyActivityServer } from "./types";
import { qaServer } from "./qa/server";
import { voteServer } from "./vote/server";
import { diceServer } from "./dice/server";

/** Server entries by id; register here as well as in index.ts. */
export const ACTIVITY_SERVERS: Readonly<Record<string, AnyActivityServer>> = {
  qa: qaServer,
  vote: voteServer,
  dice: diceServer,
};

export function findActivityServer(type: string): AnyActivityServer | null {
  return Object.hasOwn(ACTIVITY_SERVERS, type) ? ACTIVITY_SERVERS[type] : null;
}
