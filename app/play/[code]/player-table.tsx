"use client";

import { addTransitionType, startTransition, useEffect, useRef, useState, ViewTransition } from "react";
import type { TableSnapshot } from "@/lib/tables";
import { DECK_MOTION } from "../../campaigns/[id]/motion";
import { ForPlayers, OpenerScreen, PlayerScreen } from "../../campaigns/[id]/player-screen";
import { slidesOf } from "../../campaigns/[id]/slides";
import { PreloadVideos } from "../../campaigns/[id]/slide-video";
import { Soundtrack } from "../../campaigns/[id]/soundtrack";
import { tableSubjects, type Seat } from "@/lib/subjects";
import { UNTITLED_CHARACTER } from "@/lib/character-doc";
import { ChatIcon, CloseIcon } from "../../icons";
import { CharacterPortrait } from "../../characters/character-portrait";
import { LeadAvatar, TableChat, useTableChat } from "../chat";
import type { ActivityFeed, LiveActivity } from "@/activities/types";
import { activityAction, sendChatAction } from "./actions";
import { CharacterPicker } from "./character-picker";
import { effectsVolume, musicVolume, SettingsPanel, useSoundPrefs, videoVolume } from "../sound";
import styles from "../play.module.css";

type Playback = { slide: string; playing: boolean; position: number; receivedAt: number };
type TableState = {
  open: boolean;
  seats?: Seat[];
  slide?: string | null;
  playback?: Omit<Playback, "receivedAt"> | null;
  /** A change means fetch the new snapshot. */
  snapshotAt?: number;
  activity?: ActivityFeed | null;
  /** The TL took this seat off the table. */
  removed?: boolean;
};

/** The feed is subscribed once and reads current values through refs, never reopening per render. */
export function PlayerTable({
  code,
  title,
  name,
  seatId,
  snapshot: initialSnapshot,
  initialSlide,
}: {
  code: string;
  title: string;
  name: string;
  seatId: string;
  snapshot: TableSnapshot;
  initialSlide: string | null;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [picking, setPicking] = useState(false);
  const snapshotAt = useRef(initialSnapshot.savedAt ?? 0);
  const order = useRef<string[]>([]);
  const slides = slidesOf(snapshot.doc);
  const [slideId, setSlideId] = useState(initialSlide);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [open, setOpen] = useState(true);
  const [removed, setRemoved] = useState(false);
  const [feed, setFeed] = useState<LiveActivity | null>(null);
  const [arrived, setArrived] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chat = useTableChat(open ? `/play/${code}/chat` : null);
  const [seenCount, setSeenCount] = useState(0);
  if (chatOpen && seenCount !== chat.length) setSeenCount(chat.length);
  const unread = chat.slice(seenCount).filter((m) => m.fromLead || m.seatId !== seatId).length;
  const prefs = useSoundPrefs();
  // Sound already chosen on an earlier visit: skip the sound screen.
  const settled = arrived || prefs.chosen;
  const subjects = tableSubjects(seats, snapshot.cast);
  const subjectOf = (seat: string | null) => subjects.find((x) => x.id === seat) ?? null;
  const nameOf = (seat: string) => subjectOf(seat)?.name ?? "Someone who left";
  const names = { nameOf, subjects };
  const play = { mySeat: seatId, act: (action: string, payload?: unknown) => activityAction(code, feed?.slide, action, payload) };
  const shown = useRef(initialSlide);

  useEffect(() => {
    order.current = slides.map((s) => s.id);
  });

  useEffect(() => {
    if (!open) return;
    const source = new EventSource(`/play/${code}/events`);
    source.onmessage = (event) => {
      let state: TableState;
      try {
        state = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!state.open || state.removed) {
        source.close();
        setOpen(false);
        if (state.removed) setRemoved(true);
        return;
      }
      setFeed(state.activity ? { ...state.activity, receivedAt: performance.now() } : null);
      setPlayback(state.playback ? { ...state.playback, receivedAt: performance.now() } : null);
      if (state.seats) setSeats(state.seats);
      if (state.snapshotAt && state.snapshotAt !== snapshotAt.current) {
        snapshotAt.current = state.snapshotAt;
        fetch(`/play/${code}/snapshot`, { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : null))
          .then((next: TableSnapshot | null) => next && setSnapshot(next))
          .catch(() => undefined);
      }
      const next = state.slide ?? null;
      const prev = shown.current;
      if (next === prev) return;
      shown.current = next;
      const ids = order.current;
      const direction = ids.indexOf(next ?? "") >= ids.indexOf(prev ?? "") ? "page-next" : "page-prev";
      startTransition(() => {
        addTransitionType(direction);
        setSlideId(next);
      });
    };
    return () => source.close();
  }, [code, open]);

  const slide = slides.find((s) => s.id === slideId) ?? slides[0] ?? null;
  const mediaBase = `/play/${code}/media`;
  const follow = playback && slide && playback.slide === slide.id ? playback : null;
  const myCharacter = snapshot.cast.find((c) => c.id === seats.find((s) => s.id === seatId)?.characterId);

  return (
    <div className={styles.table} data-chat={open && chatOpen ? "" : undefined}>
      <header className={styles.bar}>
        <span className={styles.barTitle}>{title}</span>
        <span className={styles.barRight}>
          {snapshot.cast.length > 0 ? (
            <button type="button" className={styles.barSound} onClick={() => setPicking(true)}>
              {myCharacter ? `as ${myCharacter.name.trim() || UNTITLED_CHARACTER}` : "Pick a character"}
            </button>
          ) : null}
          <button type="button" className={styles.barSound} onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <span className={styles.barName}>{name}</span>
        </span>
      </header>
      <main className={styles.stage}>
        {removed ? (
          <div className={styles.center}>
            <h1 className={styles.title}>You&apos;ve been removed from the table</h1>
          </div>
        ) : !open ? (
          <div className={styles.center}>
            <h1 className={styles.title}>The table has closed</h1>
            <p className={styles.note}>Thanks for playing.</p>
          </div>
        ) : slide ? (
          <ForPlayers value={true}>
          <ViewTransition key={slide.id} {...DECK_MOTION} default="none">
            <div className={styles.slide}>
              {slide.kind === "opener" && slide.chapter.opener ? (
                <OpenerScreen mediaBase={mediaBase} opener={slide.chapter.opener} />
              ) : slide.kind === "page" ? (
                <PlayerScreen
                  mediaBase={mediaBase}
                  page={slide.page}
                  cast={snapshot.cast}
                  video={{ mode: "follow", playback: follow, volume: videoVolume(prefs) }}
                  activity={{ feed, names, seats, play }}
                />
              ) : null}
            </div>
          </ViewTransition>
          </ForPlayers>
        ) : (
          <p className={styles.note}>Waiting for the Table Lead…</p>
        )}
        {open && !removed ? <PreloadVideos slides={slides} current={slide?.id ?? null} mediaBase={mediaBase} /> : null}
        <Soundtrack
          slides={slides}
          current={slide?.id ?? null}
          mediaBase={mediaBase}
          enabled={settled && open && !removed}
          music={musicVolume(prefs)}
          effects={effectsVolume(prefs)}
        />
      </main>
      {open ? (
        <aside className={styles.chatPanel} aria-label="Chat" data-open={chatOpen ? "" : undefined} inert={!chatOpen}>
          <div className={styles.chatInner}>
          <div className={styles.chatHead}>
            <h2 className={styles.chatTitle}>Chat</h2>
            <button type="button" className={styles.chatClose} aria-label="Close chat" onClick={() => setChatOpen(false)}>
              <CloseIcon size={16} />
            </button>
          </div>
          <TableChat
            messages={chat}
            isMine={(m) => m.seatId === seatId && !m.fromLead}
            nameOf={(m) => (m.fromLead ? "Table Lead" : (subjectOf(m.seatId)?.name ?? m.name))}
            avatarOf={(m) => (m.fromLead ? <LeadAvatar /> : <CharacterPortrait character={subjectOf(m.seatId)} size={28} />)}
            send={(body) => sendChatAction(code, body)}
            autoFocus={chatOpen}
          />
          </div>
        </aside>
      ) : null}
      {open ? (
        <button
          type="button"
          className={styles.chatFab}
          data-open={chatOpen ? "" : undefined}
          aria-expanded={chatOpen}
          aria-label={chatOpen ? "Close chat" : unread > 0 ? `Chat, ${unread} new` : "Chat"}
          onClick={() => setChatOpen((o) => !o)}
        >
          {chatOpen ? <CloseIcon size={22} /> : <ChatIcon size={24} />}
          {!chatOpen && unread > 0 ? (
            <span className={styles.unread} aria-hidden>
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      ) : null}
      <SettingsPanel
        open={!settled || settingsOpen}
        gate={!settled}
        onClose={() => {
          if (!settled && !myCharacter && snapshot.cast.length > 0) setPicking(true);
          setArrived(true);
          setSettingsOpen(false);
        }}
      />
      <CharacterPicker
        open={settled && picking}
        code={code}
        cast={snapshot.cast}
        seats={seats}
        mySeat={seatId}
        onClose={() => setPicking(false)}
      />
    </div>
  );
}
