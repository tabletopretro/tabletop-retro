"use client";

import { DieIcon } from "@/app/icons";
import type { StageProps } from "../types";
import { D20 } from "./d20";
import { diceStyleOf, type DiceConfig } from "./definition";
import { turnLink } from "./turn-link";
import { nextRoller, type DiceTurn } from "./turns";
import styles from "./d20.module.css";

/** Only the stage mounts the WebGL die; thumbnails get a still icon. */
export function DiceStage({ config, live, feed, table, local, names }: StageProps<DiceConfig, DiceTurn | null>) {
  if (!live) return <DieIcon size={64} className={styles.still} />;
  const link = turnLink(feed, table, local);
  const byId = (id: string | null) => names.subjects.find((c) => c.id === id) ?? null;
  const last = link.turn.last;
  return (
    <D20
      diceStyle={diceStyleOf(config)}
      holders={link.turn.holders.flatMap((id) => byId(id) ?? [])}
      roller={byId(nextRoller(link.turn))}
      onRolled={link.rolled}
      announce={last ? { at: last.at, name: last.who ? (byId(last.who)?.name ?? null) : null, value: last.value } : null}
    />
  );
}
