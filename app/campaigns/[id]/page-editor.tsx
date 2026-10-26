"use client";

import {
  useRef,
  useState,
  ViewTransition,
  type DragEvent as ReactDragEvent,
} from "react";
import {
  activityHasContent,
  DOC_LIMITS,
  HEADING_REVEALS,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  PAGE_KINDS,
  type CampaignPage, type SoundRef,
  type PageKind,
} from "@/lib/campaign-doc";
import { UNNAMED_CHARACTER, UNTITLED_CHARACTER, type Character } from "@/lib/character-doc";
import { CharacterPortrait } from "../../characters/character-portrait";
import { ActivityIcon, ImageIcon, PlusIcon, QuoteIcon } from "../../icons";
import { uploadPageImageAction } from "./actions";
import { ActivityEditor } from "./activity-editor";
import { ConfirmDialog } from "./confirm-dialog";
import { PrivateHint } from "../../private-hint";
import { derivedLabel, EMPTY_PAGE_LABEL } from "./page-label";
import { isVideoFile, useVideoUpload, VideoPlate } from "./video-block";
import { SoundBlock } from "./sound-block";
import { Tooltip } from "../../tooltip";
import styles from "./editor.module.css";

type PagePatch = Partial<Omit<CampaignPage, "id">>;

const COUNTER_FROM = Math.round(DOC_LIMITS.textLength * 0.8);

export const ACCEPT = Object.keys(IMAGE_TYPES).join(",");

/** Keep the screen's content order identical to PlayerScreen: heading, image, video, body text. */
export function PageEditor({
  campaignId,
  page,
  label,
  cast,
  musicBefore = null,
  onChange,
  onStructuralChange,
}: {
  campaignId: string;
  page: CampaignPage;
  musicBefore?: SoundRef | null;
  cast: Character[];
  label: string;
  /** Typing: coalesced into one undo step per field. */
  onChange: (patch: PagePatch) => void;
  /** Image swaps and "Use page name": their own undo step. */
  onStructuralChange: (pageId: string, patch: PagePatch) => void;
}) {
  // This component remounts per page, so these never leak across pages.
  const [addingHeading, setAddingHeading] = useState(false);
  const [addingText, setAddingText] = useState(false);
  const video = useVideoUpload(campaignId, (name) => onStructuralChange(page.id, { video: name }));
  const image = useImageUpload(
    campaignId,
    (name) => onStructuralChange(page.id, { image: name }),
    (file) => {
      if (!isVideoFile(file)) return false;
      video.upload(file);
      return true;
    },
  );
  const [confirmKind, setConfirmKind] = useState<PageKind | null>(null);

  const hasContent: Record<PageKind, boolean> = {
    story: page.heading !== "" || page.image !== null || page.video !== null || page.text !== "",
    activity: activityHasContent(page.activity),
    speech: page.speakerId !== null || page.line !== "",
  };

  function switchKind(kind: PageKind) {
    if (page.kind && hasContent[page.kind]) return setConfirmKind(kind);
    applyKind(kind);
  }

  function applyKind(kind: PageKind) {
    setConfirmKind(null);
    onStructuralChange(page.id, {
      kind,
      ...(kind !== "story" ? { heading: "", image: null, imageAlt: "", text: "", video: null, videoAutoplay: false } : {}),
      ...(kind !== "activity" ? { activity: null } : {}),
      ...(kind !== "speech" ? { speakerId: null, line: "" } : {}),
    });
  }

  const showHeading = addingHeading || page.heading !== "";
  const showText = addingText || page.text !== "";
  const heading = showHeading ? (
    <HeadingBlock
      page={page}
      autoFocus={addingHeading && page.heading === ""}
      onChange={onChange}
      onStructuralChange={onStructuralChange}
      onDone={() => setAddingHeading(false)}
    />
  ) : null;

  return (
    <article className={styles.pageEditor}>
      <header className={styles.pageBar}>
        <span className={styles.pageBarLabel}>{label}</span>
        <input
          className={styles.pageBarName}
          value={page.title}
          maxLength={DOC_LIMITS.titleLength}
          placeholder={derivedLabel(page, cast) ?? EMPTY_PAGE_LABEL}
          aria-label="Page name (optional)"
          aria-describedby={`page-name-hint-${page.id}`}
          onChange={(event) => onChange({ title: event.target.value })}
        />
        <PrivateHint label="Optional · only you see it" />
        <span id={`page-name-hint-${page.id}`} className={styles.srOnly}>
          Optional, and only you see it. Without one, the page is labelled by what&apos;s on it.
        </span>
        {page.kind ? <KindSwitch kind={page.kind} onPick={switchKind} /> : null}
      </header>

      <section className={styles.screenBlock} aria-labelledby={`screen-${page.id}`}>
        <p id={`screen-${page.id}`} className={styles.eyebrow}>
          On the table
        </p>
        {page.kind === null ? (
          <KindChooser onPick={(kind) => onStructuralChange(page.id, { kind })} />
        ) : page.kind === "activity" ? (
          <div className={styles.screen}>
            <ActivityEditor campaignId={campaignId} page={page} onChange={onChange} onStructuralChange={onStructuralChange} />
          </div>
        ) : page.kind === "speech" ? (
          <div className={styles.screen}>
            <SpeechEditor page={page} cast={cast} onChange={onChange} onStructuralChange={onStructuralChange} />
          </div>
        ) : (
          <div className={styles.screen} data-dragging={image.dragging ? "" : undefined} {...image.dropHandlers}>
          {heading ?? (
            <button type="button" className={styles.addElement} onClick={() => setAddingHeading(true)}>
              <PlusIcon size={16} />
              Heading
            </button>
          )}
          {page.image ? (
            <Plate
              campaignId={campaignId}
              image={page.image}
              imageAlt={page.imageAlt}
              uploading={image.uploading}
              onReplace={image.pick}
              onRemove={() => onStructuralChange(page.id, { image: null, imageAlt: "" })}
              onAltChange={(imageAlt) => onChange({ imageAlt })}
            />
          ) : (
            <button
              type="button"
              className={styles.addElement}
              disabled={image.uploading}
              onClick={image.pick}
            >
              {image.uploading ? <ImageIcon size={16} /> : <PlusIcon size={16} />}
              {image.uploading ? "Uploading…" : "Image"}
              <span className={styles.addHint}>or drop one here</span>
            </button>
          )}
          {page.video ? (
            <VideoPlate
              campaignId={campaignId}
              video={page.video}
              autoplay={page.videoAutoplay}
              uploading={video.uploading}
              progress={video.progress}
              onReplace={video.pick}
              onRemove={() => onStructuralChange(page.id, { video: null, videoAutoplay: false })}
              onAutoplayChange={(videoAutoplay) => onStructuralChange(page.id, { videoAutoplay })}
            />
          ) : (
            <button type="button" className={styles.addElement} disabled={video.uploading} onClick={video.pick}>
              <PlusIcon size={16} />
              {video.uploading ? `Uploading… ${video.progress ?? 0}%` : "Video"}
              <span className={styles.addHint}>up to 100 MB</span>
            </button>
          )}
          {video.picker}
          {video.error ? (
            <p className={styles.fieldError} role="alert">
              {video.error}
            </p>
          ) : null}
          {showText ? (
            <label className={styles.textBlock}>
              <span className={styles.srOnly}>Body text</span>
              <textarea
                className={styles.pageText}
                value={page.text}
                maxLength={DOC_LIMITS.textLength}
                placeholder="What the players read"
                rows={3}
                autoFocus={addingText && page.text === ""}
                onChange={(event) => onChange({ text: event.target.value })}
                onBlur={() => setAddingText(false)}
              />
              {page.text.length >= COUNTER_FROM ? (
                <span className={styles.counter} aria-live="polite">
                  {page.text.length.toLocaleString()} / {DOC_LIMITS.textLength.toLocaleString()}
                </span>
              ) : null}
            </label>
          ) : (
            <button type="button" className={styles.addElement} onClick={() => setAddingText(true)}>
              <PlusIcon size={16} />
              Body text
            </button>
          )}

          {image.picker}
          {image.error ? (
            <p className={styles.fieldError} role="alert">
              {image.error}
            </p>
          ) : null}
        </div>
        )}
      </section>

      <SoundBlock
        campaignId={campaignId}
        id={page.id}
        page={page}
        musicBefore={musicBefore}
        onChange={(patch) => onStructuralChange(page.id, patch)}
      />

      <section className={styles.notesBlock}>
        <div className={styles.notesLabel}>
          <label className={styles.eyebrow} htmlFor={`notes-${page.id}`}>
            Speaker notes
          </label>
          <PrivateHint label="Only you see speaker notes" />
        </div>
        <textarea
          id={`notes-${page.id}`}
          className={styles.notes}
          value={page.notes}
          maxLength={DOC_LIMITS.notesLength}
          placeholder="What you want to say or remember on this page"
          rows={3}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </section>
      <ConfirmDialog
        open={confirmKind !== null}
        title={confirmKind ? KIND_QUESTIONS[confirmKind] : ""}
        confirmLabel="Clear and switch"
        onConfirm={() => confirmKind && applyKind(confirmKind)}
        onClose={() => setConfirmKind(null)}
      >
        {page.kind ? KIND_LOSSES[page.kind] : null}{" "}
        ⌘Z brings it back.
      </ConfirmDialog>
    </article>
  );
}

/** Heading and page name aren't linked; "Use page name" copies it once. Leaving it empty removes the field. */
function HeadingBlock({
  page,
  autoFocus,
  onChange,
  onStructuralChange,
  onDone,
}: {
  page: CampaignPage;
  autoFocus: boolean;
  onChange: (patch: PagePatch) => void;
  onStructuralChange: (pageId: string, patch: PagePatch) => void;
  onDone: () => void;
}) {
  const canCopyName = page.heading.trim() === "" && page.title.trim() !== "";
  return (
    <div
      className={styles.headingBlock}
      onBlur={(event) => {
        // Only when focus leaves the whole block, not moves inside it.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDone();
      }}
    >
      <input
        className={styles.heading}
        value={page.heading}
        maxLength={DOC_LIMITS.headingLength}
        placeholder="Heading"
        aria-label="Heading"
        autoFocus={autoFocus}
        onChange={(event) => onChange({ heading: event.target.value })}
      />
      {canCopyName ? (
        <div className={styles.headingTools}>
          <Tooltip content="Copies it once; they aren't linked" side="top">
            <button
              type="button"
              className={styles.toolButton}
              onClick={() =>
                onStructuralChange(page.id, { heading: page.title.trim().slice(0, DOC_LIMITS.headingLength) })
              }
            >
              Use page name
            </button>
          </Tooltip>
        </div>
      ) : page.heading.trim() !== "" ? (
        <div className={styles.headingTools}>
          <span id={`reveal-${page.id}`}>Fade in</span>
          <div className={styles.miniSegmented} role="radiogroup" aria-labelledby={`reveal-${page.id}`}>
            {HEADING_REVEALS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                role="radio"
                aria-checked={page.headingReveal === seconds}
                className={styles.miniSegment}
                onClick={() => onStructuralChange(page.id, { headingReveal: seconds })}
              >
                {seconds === 0 ? "Off" : `${seconds}s`}
              </button>
            ))}
          </div>
          {page.headingReveal > 0 ? (
            <div className={styles.miniSegmented} role="radiogroup" aria-label="Fade in by">
              {(["letter", "whole"] as const).map((by) => (
                <button
                  key={by}
                  type="button"
                  role="radio"
                  aria-checked={page.headingRevealBy === by}
                  className={styles.miniSegment}
                  onClick={() => onStructuralChange(page.id, { headingRevealBy: by })}
                >
                  {by === "letter" ? "By letter" : "Whole"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const KIND_LABELS: Record<PageKind, string> = { story: "Story", activity: "Activity", speech: "Speaking line" };

const KIND_QUESTIONS: Record<PageKind, string> = {
  story: "Make this a story page?",
  activity: "Make this an activity page?",
  speech: "Make this a speaking line?",
};

const KIND_LOSSES: Record<PageKind, string> = {
  story: "Its heading, image, video and body text will be cleared.",
  activity: "Its activity will be cleared.",
  speech: "Its speaker and line will be cleared.",
};

function KindSwitch({ kind, onPick }: { kind: PageKind; onPick: (kind: PageKind) => void }) {
  return (
    <div className={styles.kindSwitch} role="radiogroup" aria-label="Page kind">
      {PAGE_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={kind === k}
          className={styles.kindOption}
          onClick={() => kind !== k && onPick(k)}
        >
          {KIND_LABELS[k]}
        </button>
      ))}
    </div>
  );
}

function KindChooser({ onPick }: { onPick: (kind: PageKind) => void }) {
  return (
    <div className={styles.kindChooser}>
      <button type="button" className={styles.kindChoice} onClick={() => onPick("story")}>
        <span className={styles.kindChoiceTitle}>Story</span>
        <span className={styles.kindChoiceText}>A heading, an image and text the players read.</span>
      </button>
      <button type="button" className={styles.kindChoice} onClick={() => onPick("activity")}>
        <span className={styles.kindChoiceTitle}>
          <ActivityIcon size={16} />
          Activity
        </span>
        <span className={styles.kindChoiceText}>A Q&amp;A, a vote or a game.</span>
      </button>
      <button type="button" className={styles.kindChoice} onClick={() => onPick("speech")}>
        <span className={styles.kindChoiceTitle}>
          <QuoteIcon size={16} />
          Speaking line
        </span>
        <span className={styles.kindChoiceText}>A character speaks to the table.</span>
      </button>
    </div>
  );
}

/** A speaker who left the cast or was deleted stays picked and reads as unnamed; never drop the reference. */
function SpeechEditor({
  page,
  cast,
  onChange,
  onStructuralChange,
}: {
  page: CampaignPage;
  cast: Character[];
  onChange: (patch: PagePatch) => void;
  onStructuralChange: (pageId: string, patch: PagePatch) => void;
}) {
  const speaker = page.speakerId ? (cast.find((c) => c.id === page.speakerId) ?? null) : null;
  const orphaned = page.speakerId !== null && speaker === null;
  return (
    <div className={styles.speech}>
      {cast.length === 0 && !orphaned ? (
        <p className={styles.speechEmpty}>Add a character to the cast to give them a line.</p>
      ) : (
        <div className={styles.speakers} role="radiogroup" aria-label="Speaker">
          {cast.map((character) => {
            const name = character.name.trim() || UNTITLED_CHARACTER;
            return (
              <button
                key={character.id}
                type="button"
                role="radio"
                aria-checked={page.speakerId === character.id}
                className={styles.speaker}
                onClick={() => onStructuralChange(page.id, { speakerId: character.id })}
              >
                <CharacterPortrait character={character} size={44} />
                {name}
              </button>
            );
          })}
          {orphaned ? (
            <button type="button" role="radio" aria-checked className={styles.speaker}>
              <CharacterPortrait character={null} size={44} />
              {UNNAMED_CHARACTER}
            </button>
          ) : null}
        </div>
      )}
      <textarea
        className={styles.speechLine}
        value={page.line}
        maxLength={DOC_LIMITS.lineLength}
        placeholder={speaker ? `What ${speaker.name.trim() || "they"} says` : "What they say"}
        aria-label="Line"
        rows={2}
        onChange={(event) => onChange({ line: event.target.value })}
      />
    </div>
  );
}

/**
 * Picking, dropping and uploading an image. `onUploaded` is captured when an
 * upload starts, so moving to another page mid-upload still lands it where it was dropped.
 */
export function useImageUpload(
  campaignId: string,
  onUploaded: (name: string) => void,
  /** Given a dropped file first; returns true if it took it (a video, say). */
  onOtherFile?: (file: File) => boolean,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!(file.type in IMAGE_TYPES)) return setError("Use a WebP, PNG, JPEG or GIF");
    if (file.size > IMAGE_MAX_BYTES) return setError("Images can be up to 5 MB");
    // Captured now: the TL may switch pages before the upload lands.
    const done = onUploaded;
    setUploading(true);
    try {
      const body = new FormData();
      body.set("image", file);
      const result = await uploadPageImageAction(campaignId, body);
      if (result.ok) done(result.name);
      else setError(result.error);
    } catch {
      setError("The upload didn't go through. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      className={styles.srOnly}
      tabIndex={-1}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void upload(file);
      }}
    />
  );

  const dropHandlers = {
    onDragOver: (event: ReactDragEvent) => {
      if (!event.dataTransfer.types.includes("Files") || uploading) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: ReactDragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (event: ReactDragEvent) => {
      if (!event.dataTransfer.types.includes("Files")) return;
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files[0];
      if (file && onOtherFile?.(file)) return;
      if (file) void upload(file);
    },
  };

  return {
    pick: () => inputRef.current?.click(),
    picker,
    dropHandlers,
    dragging,
    uploading,
    error,
  };
}

export function Plate({
  campaignId,
  image,
  imageAlt,
  uploading,
  onReplace,
  onRemove,
  onAltChange,
}: {
  campaignId: string;
  image: string;
  imageAlt: string;
  uploading: boolean;
  onReplace: () => void;
  onRemove: () => void;
  onAltChange: (alt: string) => void;
}) {
  return (
    <div className={styles.imageSlot}>
      <ViewTransition
        key={image}
        enter={{ image: "image-in", default: "none" }}
        exit={{ image: "image-out", default: "none" }}
        default="none"
      >
        <figure className={styles.plate} aria-busy={uploading}>
          {/* Owner-only route with private caching; next/image would
              proxy it through the optimizer without the session. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/campaigns/${campaignId}/images/${image}`}
            alt={imageAlt}
            className={styles.plateImage}
          />
          <div className={styles.plateActions}>
            <button type="button" className={styles.chip} onClick={onReplace} disabled={uploading}>
              {uploading ? "Uploading…" : "Replace"}
            </button>
            <button type="button" className={styles.chip} onClick={onRemove} disabled={uploading}>
              Remove
            </button>
          </div>
        </figure>
      </ViewTransition>
      <input
        className={styles.altInput}
        value={imageAlt}
        maxLength={DOC_LIMITS.altLength}
        placeholder="Describe the image for screen readers"
        aria-label="Image description"
        onChange={(event) => onAltChange(event.target.value)}
      />
    </div>
  );
}
