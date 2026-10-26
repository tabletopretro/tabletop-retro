"use client";

import type { VoteTally } from "./definition";
import styles from "../kit/asked.module.css";

export function VoteResults({
  options,
  tally,
  nameOf,
  mine = null,
  compact = false,
}: {
  options: string[];
  tally: VoteTally;
  nameOf: (seatId: string) => string;
  mine?: number | null;
  compact?: boolean;
}) {
  const top = Math.max(1, ...tally.counts);
  return (
    <ol className={styles.tally} data-compact={compact ? "" : undefined}>
      {options.map((option, index) =>
        option.trim() ? (
          <li key={index} className={styles.tallyRow} data-mine={mine === index ? "" : undefined}>
            <span className={styles.tallyHead}>
              <span className={styles.tallyOption}>{option}</span>
              <span className={styles.tallyCount}>{tally.counts[index] ?? 0}</span>
            </span>
            <span className={styles.bar} aria-hidden>
              <span style={{ width: `${((tally.counts[index] ?? 0) / top) * 100}%` }} />
            </span>
            {tally.voters?.[index]?.length ? (
              <span className={styles.voters}>{tally.voters[index].map(nameOf).join(", ")}</span>
            ) : null}
          </li>
        ) : null,
      )}
    </ol>
  );
}
