"use client";

import { UNNAMED_CHARACTER, UNTITLED_CHARACTER } from "@/lib/character-doc";
import type { PlayProps } from "../types";
import { D20, useRollInFlight } from "./d20";
import { diceStyleOf, type DiceConfig } from "./definition";
import type { DiceTurn } from "./turns";
import styles from "./d20.module.css";

export function DicePlay({ config, feed, mySeat, names, act }: PlayProps<DiceConfig, DiceTurn | null>) {
  const turn = feed?.data ?? null;
  const byId = (id: string | null) => names.subjects.find((x) => x.id === id) ?? null;
  const nameOf = (id: string | null) => {
    const c = byId(id);
    return c ? c.name.trim() || UNTITLED_CHARACTER : UNNAMED_CHARACTER;
  };
  const holders = (turn?.holders ?? []).flatMap((id) => byId(id) ?? []);
  const last = turn?.last ?? null;
  const flying = useRollInFlight(last?.at ?? null);
  const rolls = Object.entries(turn?.rolls ?? {}).filter(([id]) => !(flying && id === last?.who));
  const top = rolls.length > 0 ? Math.max(...rolls.map(([, v]) => v)) : null;
  const canRoll = Boolean(turn?.holders.includes(mySeat) && turn.rolls[mySeat] === undefined);

  return (
    <>
      <D20
        diceStyle={diceStyleOf(config)}
        holders={holders}
        roller={canRoll ? byId(mySeat) : null}
        canRoll={canRoll}
        requestRoll={() => act("roll", {}).catch(() => undefined)}
        announce={last ? { at: last.at, name: last.who ? nameOf(last.who) : null, value: last.value } : null}
      />
      {rolls.length > 1 ? (
        <ul className={styles.rollList}>
          {rolls.map(([id, value]) => (
            <li key={id} data-top={value === top ? "" : undefined}>
              {nameOf(id)} <strong>{value}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
