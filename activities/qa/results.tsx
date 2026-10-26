"use client";

import type { QaAnswer } from "./definition";
import styles from "../kit/asked.module.css";

export function AnswerCards({
  answers,
  nameOf,
  mine = [],
  compact = false,
}: {
  answers: QaAnswer[];
  nameOf: (seatId: string) => string;
  mine?: string[];
  compact?: boolean;
}) {
  if (answers.length === 0) return null;
  return (
    <ul className={styles.cards} data-compact={compact ? "" : undefined}>
      {answers.map((a) => (
        <li key={a.id} className={styles.card} data-mine={mine.includes(a.id) ? "" : undefined}>
          <span className={styles.cardText}>{a.answer}</span>
          {a.seatId ? <span className={styles.cardBy}>{nameOf(a.seatId)}</span> : null}
        </li>
      ))}
    </ul>
  );
}
