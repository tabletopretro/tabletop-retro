"use client";

import type { ReactNode } from "react";
import type { LiveActivity } from "../types";
import { Countdown } from "./timer";
import styles from "./asked.module.css";

export function Asked({ prompt, feed, children }: { prompt: string; feed: LiveActivity | null; children?: ReactNode }) {
  return (
    <div className={styles.asked}>
      <header className={styles.head}>
        {prompt ? <h2 className={styles.prompt}>{prompt}</h2> : null}
        <Countdown feed={feed} />
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

export function AskedError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className={styles.error} role="alert">
      {error}
    </p>
  );
}
