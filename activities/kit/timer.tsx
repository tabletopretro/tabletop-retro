"use client";

import { useEffect, useState, useTransition } from "react";
import type { ActivityResult, LiveActivity } from "../types";
import { TimerIcon } from "@/app/icons";
import styles from "./asked.module.css";

/** Milliseconds left on the timer, counting down from when the feed arrived; null with no timer. */
export function useRemaining(feed: LiveActivity | null) {
  const timer = feed?.timer ?? null;
  const [now, setNow] = useState(() => performance.now());
  const running = Boolean(timer?.running && timer.remainingMs > 0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, [running, feed?.receivedAt]);
  if (!timer || !feed) return null;
  if (!timer.running) return timer.remainingMs;
  return Math.max(0, timer.remainingMs - Math.max(0, now - feed.receivedAt));
}

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function Countdown({ feed }: { feed: LiveActivity | null }) {
  const remaining = useRemaining(feed);
  if (remaining === null || !feed?.timer) return null;
  const done = feed.timer.running && remaining <= 0;
  return (
    <p
      className={styles.countdown}
      data-low={!done && feed.timer.running && remaining <= 10_000 ? "" : undefined}
      data-done={done ? "" : undefined}
      role="timer"
      aria-live={done ? "polite" : "off"}
    >
      <TimerIcon size={18} />
      {done ? "Time's up" : clock(remaining)}
    </p>
  );
}

export function useOpen(feed: LiveActivity | null) {
  const remaining = useRemaining(feed);
  if (!feed || feed.locked) return false;
  return !(feed.timer?.running && remaining !== null && remaining <= 0);
}

/** `run(work, after)` keeps the server's error, or a generic one when the table couldn't be reached; `after` runs on success. */
export function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (work: () => Promise<ActivityResult>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await work();
        if (result.ok) after?.();
        else setError(result.error);
      } catch {
        setError("Couldn't reach the table. Try again.");
      }
    });
  return { run, pending, error };
}
