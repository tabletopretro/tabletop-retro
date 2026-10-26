"use client";

import { useEffect, useEffectEvent, useRef, useState, ViewTransition, type ReactNode } from "react";
import type { ActivityResult, LiveActivity, TableLink } from "@/activities/types";
import type { CampaignDoc } from "@/lib/campaign-doc";
import type { Character } from "@/lib/character-doc";
import { seatViews, tableSubjects, type Seat, type SeatView } from "@/lib/subjects";
import { ReleaseCharacter, RemoveSeat, SeatIdentity } from "../../table/seat-identity";
import { ActivityControls } from "./activity-controls";
import { CharacterPortrait } from "../../characters/character-portrait";
import { LeadAvatar, TableChat, useTableChat } from "../../play/chat";
import { sendTableChatAction } from "./table-actions";
import { ConfirmDialog } from "./confirm-dialog";
import { pageLabel } from "./page-label";
import { PreloadVideos } from "./slide-video";
import { musicBeforeBySlide, musicBySlide, Soundtrack } from "./soundtrack";
import { SoundBadges } from "./sound-badges";
import { effectsVolume, musicVolume, useSoundPrefs } from "../../play/sound";
import { DECK_MOTION, stripMotion } from "./motion";
import { slidesOf, type Slide } from "./slides";
import { OpenerScreen, PlayerScreen } from "./player-screen";
import { Tooltip } from "../../tooltip";
import { ChevronIcon } from "../../icons";
import styles from "./present.module.css";

function isTextField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit"].includes(target.type);
}

const chapterLabel = (s: Slide) => `Chapter ${s.ci + 1}`;
const slideName = (s: Slide, cast: readonly Character[]) =>
  s.kind === "opener" ? s.chapter.opener?.title.trim() || "Chapter opener" : pageLabel(s.page, cast).text;
const slideNumber = (s: Slide) => (s.kind === "opener" ? `${s.ci + 1}` : `${s.ci + 1}.${s.pi + 1}`);
const notesOf = (s: Slide) => (s.kind === "opener" ? (s.chapter.opener?.notes ?? "") : s.page.notes);

const STRIP_REACH = 2;

/**
 * Present mode: the current slide, navigation, a filmstrip and the side
 * panels, sharing the editor's selection. Chapters are crossed deliberately:
 * forward keys stop at a chapter's last slide (Shift+→ closes it) and back
 * keys at its first (Shift+← asks to reopen). Keys are caught in the capture
 * phase and stopped so nothing else on the page reacts to them.
 */
export function PresentView({
  campaignId,
  doc,
  cast,
  seats,
  selectedId,
  onNavigate,
  onVideoPlayback,
  onReleaseSeat,
  remoteActivity = null,
  onLeadAction,
  onShowAnswers,
  onRestartTimer,
  onRemoveSeat,
}: {
  campaignId: string;
  doc: CampaignDoc;
  /** Who's joined, while the table is open for players; null when it isn't. */
  seats: Seat[] | null;
  onVideoPlayback?: (slideId: string, playing: boolean, position: number) => void;
  onReleaseSeat?: (seatId: string) => void;
  remoteActivity?: LiveActivity | null;
  onLeadAction?: (slideId: string, action: string, payload: unknown) => Promise<ActivityResult>;
  onShowAnswers?: (slideId: string, shown: boolean) => void;
  onRestartTimer?: (slideId: string) => void;
  onRemoveSeat?: (seatId: string) => void;
  /** Who speaking lines resolve to; anyone else reads as unnamed. */
  cast: Character[];
  selectedId: string | null;
  onNavigate: (slideId: string, direction: "page-next" | "page-prev") => void;
}) {
  const slides = slidesOf(doc);
  const musicNow = musicBySlide(slides);
  const musicBefore = musicBeforeBySlide(slides);
  const found = slides.findIndex((s) => s.id === selectedId);
  const index = found === -1 ? 0 : found;
  const current = slides[index] ?? null;
  const next = slides[index + 1] ?? null;
  const prev = slides[index - 1] ?? null;
  const atChapterEnd = current !== null && next !== null && next.chapter.id !== current.chapter.id;
  const atChapterStart = current !== null && prev !== null && prev.chapter.id !== current.chapter.id;
  // Activities' rehearsal state by page, kept while no table is open. Never saved.
  const [localStates, setLocalStates] = useState<Record<string, unknown>>({});
  const [reopenTo, setReopenTo] = useState<number | null>(null);
  const [removing, setRemoving] = useState<SeatView | null>(null);
  const stripRef = useRef<HTMLOListElement>(null);
  const [nudge, setNudge] = useState(0);
  const [nudgeBack, setNudgeBack] = useState(0);

  function go(to: number) {
    const target = slides[to];
    if (!target || to === index) return;
    onNavigate(target.id, to > index ? "page-next" : "page-prev");
  }

  function goOrAsk(to: number) {
    const target = slides[to];
    if (target && current && target.ci < current.ci) setReopenTo(to);
    else go(to);
  }

  const chapterStart = current ? slides.findIndex((s) => s.chapter.id === current.chapter.id) : 0;
  const chapterEnd = current ? slides.findLastIndex((s) => s.chapter.id === current.chapter.id) : 0;

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    // While the reopen confirmation is up, keys belong to the dialog.
    if (reopenTo !== null) return;
    if (event.metaKey || event.ctrlKey || event.altKey || isTextField(event.target)) return;
    const forward = ["ArrowRight", "ArrowDown", "PageDown"].includes(event.key);
    const back = ["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key);
    if (!forward && !back && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    event.stopPropagation();

    // A clicked thumbnail keeps focus, and the slot under a resting
    // pointer keeps its hover outline; either would leave a second slide
    // looking highlighted. Let go of both until the pointer moves.
    const strip = stripRef.current;
    if (strip) {
      if (strip.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      strip.dataset.keynav = "";
    }

    if (forward && atChapterEnd) {
      if (event.key === "ArrowRight" && event.shiftKey) go(index + 1);
      else setNudge((n) => n + 1);
      return;
    }
    if (back && atChapterStart) {
      if (event.key === "ArrowLeft" && event.shiftKey) setReopenTo(index - 1);
      else setNudgeBack((n) => n + 1);
      return;
    }
    if (forward) go(index + 1);
    else if (back) go(index - 1);
    else if (event.key === "Home") go(chapterStart);
    else go(chapterEnd);
  });
  // Mounted only while Present is visible (<Activity> runs effect cleanup
  // when hidden), so these keys belong to the editor again in Edit mode.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, []);

  const [open, setOpen] = useState<Record<SideSection, boolean>>({ notes: true, seats: true, controls: true, chat: true });
  const toggle = (key: SideSection) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const soundPrefs = useSoundPrefs();
  const chat = useTableChat(seats ? `/campaigns/${campaignId}/table-chat` : null);

  if (!current) {
    return (
      <div className={styles.nothing}>
        <p className={styles.nothingTitle}>Nothing to present yet</p>
        <p className={styles.placeholder}>Add a page in Edit mode and it will show up here.</p>
      </div>
    );
  }

  // Fixed slots keep the current slide centred, even at the deck's ends.
  const strip = Array.from({ length: STRIP_REACH * 2 + 1 }, (_, i) => index - STRIP_REACH + i);

  const subjects = tableSubjects(seats, cast);
  const seatRows = seats ? seatViews(seats, cast) : null;
  const names = { nameOf: (seatId: string) => subjects.find((x) => x.id === seatId)?.name ?? "Someone who left", subjects };
  const currentActivity =
    current.kind === "page" && current.page.kind === "activity" ? (current.page.activity ?? null) : null;
  const feed = remoteActivity && remoteActivity.slide === current.id ? remoteActivity : null;
  const table: TableLink | null =
    seats && onLeadAction ? { lead: (action, payload) => onLeadAction(current.id, action, payload) } : null;
  const local = {
    value: localStates[current.id] ?? null,
    set: (next: unknown) => setLocalStates((all) => ({ ...all, [current.id]: next })),
  };

  const renderScreen = (s: Slide, live = false) =>
    s.kind === "opener" && s.chapter.opener ? (
      <OpenerScreen mediaBase={`/campaigns/${campaignId}`} opener={s.chapter.opener} />
    ) : s.kind === "page" ? (
      <PlayerScreen
        mediaBase={`/campaigns/${campaignId}`}
        page={s.page}
        cast={cast}
        live={live}
        activity={live ? { feed, names, seats, lead: { table, local } } : undefined}
        video={
          live
            ? { mode: "lead", onPlayback: (playing, position) => onVideoPlayback?.(s.id, playing, position) }
            : undefined
        }
      />
    ) : null;

  return (
    <div className={styles.present}>
      <div className={styles.main}>
        <section className={styles.stage} aria-label="On the table">
          <ViewTransition key={current.id} {...DECK_MOTION} default="none">
            <div className={styles.slide}>{renderScreen(current, true)}</div>
          </ViewTransition>
        </section>

        <nav className={styles.navBar} aria-label="Slides">
          {atChapterStart && prev ? (
            <Tooltip content="Shift+←" side="top">
              <button
                type="button"
                className={styles.reopenChapter}
                data-nudge={nudgeBack === 0 ? undefined : nudgeBack % 2}
                onClick={() => setReopenTo(index - 1)}
              >
                ‹ Reopen {chapterLabel(prev)}
              </button>
            </Tooltip>
          ) : (
            <button type="button" className={styles.navButton} disabled={index === 0} onClick={() => go(index - 1)}>
              ‹ Back
            </button>
          )}
          <p className={styles.position} aria-live="polite">
            <span className={styles.positionChapter}>
              {chapterLabel(current)}
              {current.chapter.title.trim() ? `: ${current.chapter.title.trim()}` : ""}
            </span>
          </p>
          {atChapterEnd ? (
            <Tooltip content="Shift+→" side="top">
              <button
                type="button"
                className={styles.closeChapter}
                data-nudge={nudge === 0 ? undefined : nudge % 2}
                onClick={() => go(index + 1)}
              >
                Close {chapterLabel(current)} ›
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              className={styles.navButton}
              disabled={next === null}
              onClick={() => go(index + 1)}
            >
              Next ›
            </button>
          )}
        </nav>
        {/* Always rendered, so the layout doesn't shift at a chapter end. */}
        <p className={styles.navNote} aria-live="polite">
          {atChapterEnd && next ? (
            next.kind === "opener" ? (
              <>
                {chapterLabel(next)} opens with its opener: <strong>{slideName(next, cast)}</strong>
              </>
            ) : (
              <>
                {chapterLabel(next)} has no opener · starts at{" "}
                <span className={styles.number}>{slideNumber(next)}</span> <strong>{slideName(next, cast)}</strong>
              </>
            )
          ) : null}
        </p>

        <ol
          ref={stripRef}
          className={styles.strip}
          aria-label="Nearby slides"
          onPointerMove={(event) => delete event.currentTarget.dataset.keynav}
        >
          {strip.map((at, slot) => {
            const s = slides[at];
            if (!s) return <li key={`empty-${slot}`} className={styles.stripSlot} aria-hidden />;
            const isCurrent = at === index;
            const prev = slides[at - 1];
            const startsChapter = slot > 0 && prev !== undefined && prev.chapter.id !== s.chapter.id;
            return (
              <ViewTransition key={s.id} {...stripMotion(isCurrent)} default="none">
                <li className={styles.stripSlot} data-chapter-start={startsChapter ? "" : undefined}>
                  <button
                    type="button"
                    className={styles.thumbButton}
                    aria-current={isCurrent ? "step" : undefined}
                    data-past={s.ci < current.ci ? "" : undefined}
                    aria-label={`${slideNumber(s)} ${s.kind === "opener" ? "Opener: " : ""}${slideName(s, cast)}${s.ci < current.ci ? " (closed chapter)" : ""}`}
                    onClick={() => goOrAsk(at)}
                  >
                    <span className={styles.thumb} data-opener={s.kind === "opener" ? "" : undefined}>
                      <span className={styles.thumbCanvas}>{renderScreen(s)}</span>
                    </span>
                    <span className={styles.thumbLabel}>
                      <span className={styles.number}>{slideNumber(s)}</span>
                      <span className={styles.thumbName}>
                        {s.kind === "opener" ? "Opener" : slideName(s, cast)}
                      </span>
                      {s.kind === "page" ? (
                        <SoundBadges page={s.page} playing={musicNow.get(s.id) ?? null} before={musicBefore.get(s.id) ?? null} />
                      ) : s.chapter.opener ? (
                        <SoundBadges page={s.chapter.opener} playing={musicNow.get(s.id) ?? null} before={musicBefore.get(s.id) ?? null} />
                      ) : null}
                    </span>
                  </button>
                </li>
              </ViewTransition>
            );
          })}
        </ol>
      </div>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.player ?? "them"} from the table?`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (removing) onRemoveSeat?.(removing.id);
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      >
        Their answers go too. They can sit down again with the code while the table is open.
      </ConfirmDialog>

      <ConfirmDialog
        open={reopenTo !== null}
        title={`Reopen ${reopenTo !== null && slides[reopenTo] ? chapterLabel(slides[reopenTo]) : "chapter"}?`}
        confirmLabel="Reopen"
        tone="neutral"
        onConfirm={() => {
          const to = reopenTo;
          setReopenTo(null);
          if (to !== null) go(to);
        }}
        onClose={() => setReopenTo(null)}
      >
        It&apos;s been closed. Going back shows its slides to the players again.
      </ConfirmDialog>

      <PreloadVideos slides={slides} current={current?.id ?? null} mediaBase={`/campaigns/${campaignId}`} />
      <Soundtrack
        slides={slides}
        current={current?.id ?? null}
        mediaBase={`/campaigns/${campaignId}`}
        enabled
        music={musicVolume(soundPrefs)}
        effects={effectsVolume(soundPrefs)}
      />
      <aside className={styles.side}>
        <SidePanel title="Speaker notes" open={open.notes} onToggle={() => toggle("notes")} grow={1}>
          {notesOf(current) ? (
            <p className={styles.notesText}>{notesOf(current)}</p>
          ) : (
            <p className={styles.placeholder}>No notes for this {current.kind === "opener" ? "opener" : "page"}.</p>
          )}
        </SidePanel>
        {seatRows ? (
          <SidePanel title="At the table" count={seats ? seats.length : undefined} open={open.seats} onToggle={() => toggle("seats")} grow={1}>
            {seatRows.length > 0 ? (
              <ul className={styles.seatList}>
                {seatRows.map((seat) => (
                  <li key={seat.id} className={styles.seatItem}>
                    <span className={styles.seatCard}>
                      <SeatIdentity seat={seat} />
                    </span>
                    {onReleaseSeat ? <ReleaseCharacter seat={seat} onRelease={onReleaseSeat} /> : null}
                    {onRemoveSeat ? <RemoveSeat seat={seat} onRemove={setRemoving} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.tableEmpty}>Nobody yet. Share the code above.</p>
            )}
          </SidePanel>
        ) : null}
        <SidePanel title="Table controls" open={open.controls} onToggle={() => toggle("controls")} grow={1.2}>
          {currentActivity ? (
            <ActivityControls
              activity={currentActivity}
              pageId={current.id}
              feed={feed}
              table={table}
              local={local}
              names={names}
              seats={seats}
              onShow={(shown) => onShowAnswers?.(current.id, shown)}
              onRestartTimer={() => onRestartTimer?.(current.id)}
            />
          ) : (
            <p className={styles.tableEmpty}>None for this page.</p>
          )}
        </SidePanel>
        {seats ? (
          <SidePanel title="Chat" open={open.chat} onToggle={() => toggle("chat")} grow={1.4} chat>
            <TableChat
              messages={chat}
              isMine={(m) => m.fromLead}
              nameOf={(m) => subjects.find((x) => x.id === m.seatId)?.name ?? m.name}
              avatarOf={(m) =>
                m.fromLead ? (
                  <LeadAvatar />
                ) : (
                  <CharacterPortrait character={subjects.find((x) => x.id === m.seatId) ?? null} size={28} />
                )
              }
              send={(body) => sendTableChatAction(campaignId, body)}
            />
          </SidePanel>
        ) : null}
      </aside>
    </div>
  );
}

type SideSection = "notes" | "seats" | "controls" | "chat";

/** The body stays mounted when folded so a chat draft or scroll position survives. */
function SidePanel({
  title,
  count,
  open,
  onToggle,
  grow,
  chat,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  grow: number;
  chat?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel} aria-label={title} data-open={open ? "" : undefined} style={{ flexGrow: open ? grow : 0 }}>
      <button type="button" className={styles.panelHead} aria-expanded={open} onClick={onToggle}>
        <span className={styles.eyebrow}>{title}</span>
        {count !== undefined ? <span className={styles.panelCount}>{count}</span> : null}
        <ChevronIcon className={styles.panelChevron} aria-hidden />
      </button>
      <div className={chat ? styles.panelChat : styles.panelBody} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
