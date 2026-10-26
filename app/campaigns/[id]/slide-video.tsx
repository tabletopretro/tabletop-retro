"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon } from "../../icons";
import type { Slide } from "./slides";
import styles from "./present.module.css";

/** The TL's copy leads (reports each play, pause and seek); a player's follows and never takes input. */
export type VideoSync =
  | { mode: "lead"; onPlayback: (playing: boolean, position: number) => void }
  | {
      mode: "follow";
      /** The TL's playback as last heard, and when (performance.now()) it arrived. */
      playback: { playing: boolean; position: number; receivedAt: number } | null;
      /** 0–1 from the player's sound settings; 0 mutes. */
      volume: number;
    };

/** Seconds. Small drift is corrected by speed: seeking (and rebuffering) for it made playback stutter. */
const JUMP = 2;
const NUDGE = 0.3;

/** If the browser blocks sound, "Tap to play" shows once. */
export function SlideVideo({ src, autoplay, sync }: { src: string; autoplay: boolean; sync?: VideoSync }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const follow = sync?.mode === "follow" ? sync : null;
  const lead = sync?.mode === "lead" ? sync : null;

  useEffect(() => {
    if (!autoplay || follow) return;
    // A refusal (autoplay policy) just leaves the play button showing.
    ref.current?.play().catch(() => undefined);
  }, [autoplay, follow]);

  const playback = follow?.playback ?? null;
  const playbackRef = useRef(playback);

  function correct() {
    const video = ref.current;
    const p = playbackRef.current;
    if (!video || !p) return;
    const target = p.position + (p.playing ? (performance.now() - p.receivedAt) / 1000 : 0);
    if (!p.playing) {
      if (!video.paused) video.pause();
      video.playbackRate = 1;
      if (video.readyState >= 1 && Math.abs(video.currentTime - target) > NUDGE) video.currentTime = target;
      return;
    }
    if (video.paused) video.play().catch(() => setBlocked(true));
    // Still buffering: let it catch up rather than seek into another stall.
    if (video.readyState < 3) return;
    const drift = target - video.currentTime;
    if (Math.abs(drift) > JUMP) {
      video.currentTime = target;
      video.playbackRate = 1;
    } else if (Math.abs(drift) > NUDGE) {
      video.playbackRate = drift > 0 ? 1.08 : 0.92;
    } else {
      video.playbackRate = 1;
    }
  }

  useEffect(() => {
    playbackRef.current = playback;
    correct();
  });

  const volume = follow?.volume;
  useEffect(() => {
    const video = ref.current;
    if (!video || volume === undefined) return;
    video.volume = volume;
    video.muted = volume === 0;
  }, [volume]);

  const report = (video: HTMLVideoElement) => lead?.onPlayback(!video.paused, video.currentTime);

  function toggle() {
    const video = ref.current;
    if (!video || follow) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }

  function unblock() {
    const video = ref.current;
    if (!video) return;
    void video.play().then(
      () => setBlocked(false),
      () => undefined,
    );
  }

  return (
    <div className={styles.videoFrame}>
      <video
        ref={ref}
        src={src}
        className={styles.video}
        playsInline
        preload="auto"
        onClick={toggle}
        onPlay={(event) => {
          setPlaying(true);
          setEnded(false);
          report(event.currentTarget);
        }}
        onPause={(event) => {
          setPlaying(false);
          report(event.currentTarget);
        }}
        onSeeked={(event) => report(event.currentTarget)}
        onEnded={() => setEnded(true)}
        onTimeUpdate={follow ? correct : undefined}
        onCanPlay={follow ? correct : undefined}
      />
      {follow ? (
        blocked ? (
          <button type="button" className={styles.videoPlay} onClick={unblock}>
            <PlayIcon size={22} />
            Tap to play
          </button>
        ) : null
      ) : playing ? null : (
        <button type="button" className={styles.videoPlay} onClick={toggle}>
          <PlayIcon size={22} />
          {ended ? "Play again" : "Play video"}
        </button>
      )}
    </div>
  );
}

const PRELOAD_AHEAD = 3;

/** Buffers the next few slides' videos (hidden, muted, preload="auto") so a video slide plays at once. */
export function PreloadVideos({ slides, current, mediaBase }: { slides: Slide[]; current: string | null; mediaBase: string }) {
  const at = Math.max(0, slides.findIndex((s) => s.id === current));
  const upcoming = slides
    .slice(at + 1, at + 1 + PRELOAD_AHEAD)
    .flatMap((s) => (s.kind === "page" && s.page.kind === "story" && s.page.video ? [s.page.video] : []));
  return upcoming.map((name) => (
    <video
      key={name}
      src={`${mediaBase}/videos/${name}`}
      preload="auto"
      muted
      playsInline
      aria-hidden
      tabIndex={-1}
      className={styles.preload}
    />
  ));
}
