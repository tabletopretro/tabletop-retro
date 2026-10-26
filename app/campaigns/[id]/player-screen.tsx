"use client";

import { createContext, use, type ReactNode } from "react";
import { findActivity } from "@/activities";
import type { ActivityResult, LiveActivity, LocalState, Names, TableLink } from "@/activities/types";
import type { Activity, CampaignPage, ChapterOpener } from "@/lib/campaign-doc";
import { UNNAMED_CHARACTER, UNTITLED_CHARACTER, type Character } from "@/lib/character-doc";
import type { Seat } from "@/lib/subjects";
import { CharacterPortrait } from "../../characters/character-portrait";
import { SlideVideo, type VideoSync } from "./slide-video";
import styles from "./present.module.css";

/** Whether this screen is a player's. TL notes render as nothing inside it; players see a blank slide. */
export const ForPlayers = createContext(false);

/** A note to the TL about what's (not) on the slide; players never see it. */
function TlNote({ children }: { children: ReactNode }) {
  return use(ForPlayers) ? null : <p className={styles.blank}>{children}</p>;
}

/** The live table behind an activity slide. `feed` is null unless this page is the one on the table. */
export type ActivityContext = {
  feed: LiveActivity | null;
  names: Names;
  seats: Seat[] | null;
  /** On a player's screen: who they are and how they act. */
  play?: { mySeat: string; act: (action: string, payload?: unknown) => Promise<ActivityResult> };
  /** On the TL's stage: the open table (null rehearsing) and local rehearsal state. */
  lead?: { table: TableLink | null; local: LocalState };
};

const NO_LOCAL: LocalState = { value: null, set: () => undefined };

/** Keep content order identical to the editor's screen. Page name and speaker notes never render here. */
export function PlayerScreen({
  mediaBase,
  page,
  cast,
  live = false,
  video,
  activity,
}: {
  /** Where this viewer loads media from: the TL's own routes, or a player's (/play/[code]/media). */
  mediaBase: string;
  page: CampaignPage;
  cast: Character[];
  /** The slide on stage, not a thumbnail: activities mount their playable pieces. */
  live?: boolean;
  video?: VideoSync;
  activity?: ActivityContext;
}) {
  if (page.kind === "activity") {
    const definition = page.activity ? findActivity(page.activity.type) : null;
    return (
      <div
        className={`${styles.screen} ${styles.activityScreen}`}
        data-bleed={definition?.bleed ? "" : undefined}
      >
        <ActivityScreen
          mediaBase={mediaBase}
          pageId={page.id}
          activity={page.activity}
          live={live}
          cast={cast}
          context={activity && activity.feed?.slide !== page.id ? { ...activity, feed: null } : activity}
        />
      </div>
    );
  }
  if (page.kind === "speech") {
    return (
      <div className={`${styles.screen} ${styles.speechScreen}`}>
        <SpeechScreen page={page} cast={cast} />
      </div>
    );
  }
  const isPlayer = use(ForPlayers);
  const story = page.kind === "story";
  const empty = !story || (page.heading === "" && page.image === null && page.video === null && page.text === "");
  return (
    <div className={styles.screen}>
      {story && page.heading ? (
        <RevealHeading
          text={page.heading}
          seconds={page.headingReveal}
          by={page.headingRevealBy}
          animate={live || isPlayer}
        />
      ) : null}
      {story && page.image ? (
        // Owner-only route with private caching; next/image would proxy it
        // through the optimizer without the session.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${mediaBase}/images/${page.image}`}
          alt={page.imageAlt}
          className={styles.image}
        />
      ) : null}
      {story && page.video ? (
        live || video ? (
          <SlideVideo src={`${mediaBase}/videos/${page.video}`} autoplay={page.videoAutoplay} sync={video} />
        ) : (
          <video
            src={`${mediaBase}/videos/${page.video}`}
            className={styles.video}
            preload="metadata"
            muted
            playsInline
            tabIndex={-1}
          />
        )
      ) : null}
      {story && page.text ? <p className={styles.text}>{page.text}</p> : null}
      {empty ? <TlNote>Nothing on this page yet. Players would see an empty screen.</TlNote> : null}
    </div>
  );
}

/** A speaker who left the cast or was deleted reads as unnamed; the reference is kept. */
function SpeechScreen({ page, cast }: { page: CampaignPage; cast: Character[] }) {
  if (!page.speakerId && !page.line) {
    return <TlNote>No speaker or line yet. Players would see an empty screen.</TlNote>;
  }
  const speaker = page.speakerId ? (cast.find((c) => c.id === page.speakerId) ?? null) : null;
  const name = speaker ? speaker.name.trim() || UNTITLED_CHARACTER : UNNAMED_CHARACTER;
  return (
    <figure className={styles.speech}>
      {page.speakerId ? (
        <figcaption className={styles.speaker}>
          <CharacterPortrait character={speaker} size={72} />
          <span className={styles.speakerName}>{name}</span>
        </figcaption>
      ) : null}
      {page.line ? (
        <blockquote className={styles.line}>{page.line}</blockquote>
      ) : (
        <TlNote>No line written yet.</TlNote>
      )}
    </figure>
  );
}

/** With no table behind it (rehearsing, thumbnails) the activity gets no feed and names the cast. */
function ActivityScreen({
  mediaBase,
  pageId,
  activity,
  live,
  cast,
  context,
}: {
  mediaBase: string;
  /** The page's id: keys anything an activity remembers on this device. */
  pageId: string;
  activity: Activity | null;
  live: boolean;
  cast: Character[];
  context?: ActivityContext;
}) {
  if (!activity) {
    return <TlNote>No activity chosen yet. Players would see an empty screen.</TlNote>;
  }
  const definition = findActivity(activity.type);
  if (!definition) return <TlNote>This activity isn&apos;t available any more.</TlNote>;
  const why = definition.empty?.(activity);
  if (why && !context?.play) return <TlNote>{why}</TlNote>;
  const names: Names = context?.names ?? { nameOf: () => UNNAMED_CHARACTER, subjects: cast };
  if (context?.play) {
    return (
      <definition.Play
        config={activity}
        pageId={pageId}
        mediaBase={mediaBase}
        feed={context.feed}
        mySeat={context.play.mySeat}
        names={names}
        act={context.play.act}
      />
    );
  }
  return (
    <definition.Stage
      config={activity}
      pageId={pageId}
      mediaBase={mediaBase}
      live={live}
      feed={context?.feed ?? null}
      table={context?.lead?.table ?? null}
      local={context?.lead?.local ?? NO_LOCAL}
      names={names}
      seats={context?.seats ?? null}
    />
  );
}

/** A chapter opener as players see it. Speaker notes never render here. */
export function OpenerScreen({ mediaBase, opener }: { mediaBase: string; opener: ChapterOpener }) {
  return (
    <div className={`${styles.screen} ${styles.openerScreen}`}>
      {opener.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${mediaBase}/images/${opener.image}`}
          alt={opener.imageAlt}
          className={styles.openerImage}
        />
      ) : null}
      <h2 className={styles.openerTitle}>{opener.title || "Untitled chapter"}</h2>
      {opener.subtitle ? <p className={styles.openerSubtitle}>{opener.subtitle}</p> : null}
    </div>
  );
}

/**
 * Letter by letter, each letter fades over a little under half of `seconds`,
 * staggered so the whole heading is in by the end. Thumbnails and reduced
 * motion show it at once; screen readers get the heading whole.
 */
function RevealHeading({
  text,
  seconds,
  by,
  animate,
}: {
  text: string;
  seconds: number;
  by: "letter" | "whole";
  animate: boolean;
}) {
  if (!animate || seconds <= 0) return <h2 className={styles.heading}>{text}</h2>;
  if (by === "whole") {
    return (
      <h2 className={`${styles.heading} ${styles.revealLetter}`} style={{ animationDuration: `${seconds}s` }}>
        {text}
      </h2>
    );
  }
  const letters = [...text];
  const fade = seconds * 0.45;
  const spread = seconds - fade;
  let index = 0;
  return (
    <h2 className={styles.heading} aria-label={text}>
      {/* Words stay whole when the heading wraps. */}
      {text.split(/(\s+)/).map((part, w) =>
        /^\s+$/.test(part) ? (
          <span key={w} aria-hidden>
            {part}
          </span>
        ) : (
          <span key={w} className={styles.revealWord} aria-hidden>
            {[...part].map((ch, c) => {
              const at = letters.length > 1 ? (index++ / (letters.length - 1)) * spread : 0;
              return (
                <span key={c} className={styles.revealLetter} style={{ animationDuration: `${fade}s`, animationDelay: `${at}s` }}>
                  {ch}
                </span>
              );
            })}
          </span>
        ),
      )}
    </h2>
  );
}
