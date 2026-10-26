"use client";

import { UNTITLED_CHARACTER } from "@/lib/character-doc";
import { CharacterPortrait } from "@/app/characters/character-portrait";
import { ResetIcon } from "@/app/icons";
import { Tooltip } from "@/app/tooltip";
import type { ControlsProps } from "../types";
import { useRollInFlight } from "./d20";
import type { DiceConfig } from "./definition";
import { turnLink } from "./turn-link";
import { nextRoller, randomHolder, type DiceTurn } from "./turns";
import styles from "./dice-table.module.css";

/** A roll in the air shows once the die lands. */
export function DiceControls({ feed, table, local, names, seats }: ControlsProps<DiceConfig, DiceTurn | null>) {
  const link = turnLink(feed, table, local);
  const { turn } = link;
  const subjects = names.subjects;
  const flying = useRollInFlight(turn.last?.at ?? null);
  if (subjects.length === 0) {
    return (
      <p className={styles.empty}>{seats === null ? "Add characters to the cast to hand them the dice." : "Nobody's at the table yet."}</p>
    );
  }
  const hidden = flying ? turn.last?.who : undefined;
  const shownRoll = (id: string) => (id === hidden ? undefined : turn.rolls[id]);
  const values = Object.entries(turn.rolls)
    .filter(([id]) => id !== hidden)
    .map(([, v]) => v);
  const top = values.length > 0 ? Math.max(...values) : null;
  const tie = top !== null && values.filter((v) => v === top).length > 1;
  const random = randomHolder(
    subjects.map((c) => c.id),
    turn,
  );
  const next = turn.holders.length > 1 ? nextRoller(turn) : null;

  return (
    <div className={styles.dice}>
      <div className={styles.head}>
        <span className={styles.label}>Hand the dice to</span>
        <span className={styles.tools}>
          <button type="button" className={styles.action} disabled={random === null} onClick={() => random && link.random(random)}>
            Random
          </button>
          {values.length > 0 || turn.holders.length > 0 ? (
            <Tooltip content="Start over" side="top">
              <button type="button" className={styles.iconAction} aria-label="Start over" onClick={link.clear}>
                <ResetIcon size={16} />
              </button>
            </Tooltip>
          ) : null}
        </span>
      </div>
      <ul className={styles.rows}>
        {subjects.map((character) => {
          const roll = shownRoll(character.id);
          const mark = roll !== undefined && roll === top ? (tie ? "Tie" : "Goes first") : null;
          return (
            <li key={character.id} className={styles.item}>
              <button
                type="button"
                className={styles.row}
                aria-pressed={turn.holders.includes(character.id)}
                data-next={next === character.id ? "" : undefined}
                onClick={() => link.toggle(character.id)}
              >
                <CharacterPortrait character={character} size={28} />
                <span className={styles.name}>{character.name.trim() || UNTITLED_CHARACTER}</span>
                {next === character.id ? <span className={styles.mark}>Next</span> : null}
                {mark ? <span className={styles.mark}>{mark}</span> : null}
                <span className={styles.roll}>{character.id === hidden ? "…" : (roll ?? "–")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
