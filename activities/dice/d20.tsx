"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { UNTITLED_CHARACTER, type Character } from "@/lib/character-doc";
import { CharacterPortrait } from "@/app/characters/character-portrait";
import type { RollStartEvent, RuneD20Element } from "./rune-d20-element";
import styles from "./d20.module.css";

type Result = { value: number } | "rolling" | null;

/** How long a roll is in the air (the element's own 2.1s, plus a beat). */
export const ROLL_MS = 2300;

/** True while the latest roll is in the air here; timed from when this screen saw it, so clocks don't matter. */
export function useRollInFlight(lastAt: number | null): boolean {
  const [seen, setSeen] = useState(lastAt);
  const [flying, setFlying] = useState(false);
  if (lastAt !== seen) {
    setSeen(lastAt);
    setFlying(lastAt !== null);
  }
  useEffect(() => {
    if (!flying) return;
    const timer = window.setTimeout(() => setFlying(false), ROLL_MS);
    return () => window.clearTimeout(timer);
  }, [flying, seen]);
  return flying;
}

export type DiceStyle = "rune" | "scifi" | "steampunk" | "nature";

/**
 * Wraps the vendored <rune-d20>; client only (WebGL). Tapping the die rolls it too, so state follows its events.
 * Own rolls are reported at start (the face is picked up front); others replay via the patched `roll(forced)`.
 * With `requestRoll` the die never picks a face itself: the button asks the server, whose roll comes back
 * announced and replays here like anyone else's, so a player can't choose their number.
 */
export function D20({
  diceStyle = "rune",
  preview = false,
  holders = [],
  roller = null,
  onRolled,
  requestRoll,
  canRoll = true,
  announce = null,
}: {
  diceStyle?: DiceStyle;
  preview?: boolean;
  holders?: Character[];
  roller?: Character | null;
  onRolled?: (value: number) => void;
  /** Asks the server to roll; the die is locked to taps and shows the announced result. */
  requestRoll?: () => void;
  canRoll?: boolean;
  announce?: { at: number; name: string | null; value: number } | null;
}) {
  const dieRef = useRef<RuneD20Element>(null);
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<Result>(announce ? { value: announce.value } : null);
  const [rolledBy, setRolledBy] = useState<string | null>(announce?.name ?? null);
  /** The announced roll last handled, so each is replayed once. */
  const seenAt = useRef(announce?.at ?? null);
  /** Set while replaying someone else's roll: name it, and don't report it as ours. */
  const replaying = useRef<{ name: string | null } | null>(null);
  /** This die's own last roll, to recognise it when it comes back announced. */
  const ownRoll = useRef<{ value: number; at: number } | null>(null);
  // New holders start with a clean result (adjusting state while rendering, not in an effect).
  const holderKey = holders.map((c) => c.id).join(",");
  const [shownHolders, setShownHolders] = useState(holderKey);
  if (holderKey !== shownHolders) {
    setShownHolders(holderKey);
    setResult(null);
    setRolledBy(null);
  }
  const reportRoll = useEffectEvent((value: number) => onRolled?.(value));
  const startRoll = useEffectEvent((value: number | undefined) => {
    const replay = replaying.current;
    setRolledBy(replay ? replay.name : roller ? roller.name.trim() || UNTITLED_CHARACTER : null);
    setResult("rolling");
    // Our own roll: the table hears it now, while it's still in the air.
    if (!replay && value !== undefined) {
      ownRoll.current = { value, at: performance.now() };
      reportRoll(value);
    }
  });
  const finishRoll = useEffectEvent((value: number) => {
    setResult({ value });
    replaying.current = null;
  });

  const announcedAt = announce?.at ?? null;
  const replay = useEffectEvent(() => {
    const die = dieRef.current;
    if (!announce || !die) return;
    seenAt.current = announce.at;
    const own = ownRoll.current;
    if (own && own.value === announce.value && performance.now() - own.at < 5000) {
      // Our own roll coming back from the table: already shown.
      ownRoll.current = null;
      return;
    }
    replaying.current = { name: announce.name };
    void die.roll(announce.value);
  });
  useEffect(() => {
    if (!ready || announcedAt === null || announcedAt === seenAt.current) return;
    replay();
  }, [ready, announcedAt]);

  useEffect(() => {
    let live = true;
    void import("./rune-d20.js").then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const die = dieRef.current;
    if (!ready || !die) return;
    const onStart = (event: Event) => startRoll((event as RollStartEvent).detail?.value);
    const onRoll = (event: Event) => finishRoll((event as CustomEvent<{ value: number }>).detail.value);
    die.addEventListener("roll-start", onStart);
    die.addEventListener("roll", onRoll);
    return () => {
      die.removeEventListener("roll-start", onStart);
      die.removeEventListener("roll", onRoll);
    };
  }, [ready]);

  if (preview) {
    return ready ? (
      <rune-d20 ref={dieRef} className={`${styles.die} ${styles.preview}`} dice-style={diceStyle} hide-ui="" />
    ) : (
      <div className={`${styles.die} ${styles.preview}`} aria-hidden />
    );
  }

  const rolling = result === "rolling";
  const value = result && result !== "rolling" ? result.value : null;
  const nameOf = (c: Character) => c.name.trim() || UNTITLED_CHARACTER;
  const rolledName = rolledBy;

  return (
    <div className={styles.d20}>
      {holders.length > 0 ? (
        <p className={styles.holder}>
          <span className={styles.portraits}>
            {holders.map((c) => (
              <CharacterPortrait key={c.id} character={c} size={32} />
            ))}
          </span>
          <span>
            <strong>{listNames(holders.map(nameOf))}</strong> {holders.length === 1 ? "has" : "have"} the dice
            {holders.length > 1 && roller ? <> · {nameOf(roller)}&apos;s turn</> : null}
          </span>
        </p>
      ) : null}
      {ready ? (
        <rune-d20
          ref={dieRef}
          className={canRoll && !requestRoll ? styles.die : `${styles.die} ${styles.watching}`}
          dice-style={diceStyle}
          hide-ui=""
        />
      ) : (
        <div className={styles.die} aria-hidden />
      )}
      <p className={styles.result} aria-live="polite" data-rolling={rolling ? "" : undefined}>
        {rolling ? (
          "Rolling…"
        ) : value !== null ? (
          <>
            {rolledName ? <span>{rolledName} rolled</span> : null}
            <span className={styles.value}>{value}</span>
            {value === 20 ? <span className={styles.note}>Critical</span> : null}
            {value === 1 ? <span className={styles.note}>Fumble</span> : null}
          </>
        ) : null}
      </p>
      {canRoll ? (
        <button
          type="button"
          className={styles.roll}
          disabled={!ready || rolling}
          onClick={() => (requestRoll ? requestRoll() : void dieRef.current?.roll())}
        >
          {value === null ? "Roll" : "Roll again"}
        </button>
      ) : null}
    </div>
  );
}

function listNames(names: string[]) {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
