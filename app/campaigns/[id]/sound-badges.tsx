"use client";

import type { SoundRef } from "@/lib/campaign-doc";
import { MusicIcon, MusicOffIcon, SoundIcon } from "../../icons";
import { Tooltip } from "../../tooltip";
import styles from "./editor.module.css";

export function SoundBadges({
  page,
  playing,
  before,
}: {
  page: { music: SoundRef | "stop" | null; effect: SoundRef | null };
  playing: SoundRef | null;
  /** What was playing just before this slide: a stop only shows where it actually stops something. */
  before: SoundRef | null;
}) {
  const music = page.music;
  const badge = (label: string, icon: React.ReactNode, mark?: "starts" | "carry") => (
    <Tooltip content={label} side="top">
      <span
        role="img"
        aria-label={label}
        className={styles.soundBadge}
        data-starts={mark === "starts" ? "" : undefined}
        data-carry={mark === "carry" ? "" : undefined}
      >
        {icon}
      </span>
    </Tooltip>
  );
  return (
    <span className={styles.soundBadges}>
      {music === "stop"
        ? before
          ? badge(`Music stops: ${before.label || "Sound"}`, <MusicOffIcon size={13} />)
          : null
        : music
          ? badge(`Music starts: ${music.label || "Sound"}`, <MusicIcon size={13} />, "starts")
          : playing
            ? badge(`Music carries on: ${playing.label || "Sound"}`, <MusicIcon size={13} />, "carry")
            : null}
      {page.effect ? badge(`Sound effect: ${page.effect.label || "Sound"}`, <SoundIcon size={13} />) : null}
    </span>
  );
}
