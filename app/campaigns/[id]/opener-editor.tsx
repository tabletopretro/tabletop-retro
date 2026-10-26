"use client";

import { DOC_LIMITS, type CampaignChapter, type ChapterOpener, type SoundRef } from "@/lib/campaign-doc";
import { OpenerIcon, PlusIcon } from "../../icons";
import { PrivateHint } from "../../private-hint";
import styles from "./editor.module.css";
import { Plate, useImageUpload } from "./page-editor";
import { SoundBlock } from "./sound-block";

type OpenerPatch = Partial<ChapterOpener>;

export function OpenerEditor({
  campaignId,
  chapter,
  label,
  musicBefore = null,
  onAdd,
  onRemove,
  onChange,
  onStructuralChange,
}: {
  campaignId: string;
  chapter: CampaignChapter;
  label: string;
  musicBefore?: SoundRef | null;
  onAdd: () => void;
  onRemove: () => void;
  /** Typing: coalesced into one undo step per field. */
  onChange: (patch: OpenerPatch) => void;
  /** Image changes: their own undo step. */
  onStructuralChange: (patch: OpenerPatch) => void;
}) {
  const opener = chapter.opener;
  const image = useImageUpload(campaignId, (name) => onStructuralChange({ image: name }));

  return (
    <article className={styles.pageEditor}>
      <header className={styles.pageBar}>
        <span className={styles.pageBarLabel}>{label} · Opener</span>
        <span className={styles.openerChapterName}>{chapter.title.trim() || label}</span>
        {opener ? (
          <button type="button" className={styles.toolButton} onClick={onRemove}>
            Remove opener
          </button>
        ) : null}
      </header>

      {opener ? (
        <>
          <section className={styles.screenBlock} aria-label="On the table">
            <p className={styles.eyebrow}>On the table</p>
            <div
              className={`${styles.screen} ${styles.openerScreen}`}
              data-dragging={image.dragging ? "" : undefined}
              {...image.dropHandlers}
            >
              <input
                className={styles.openerTitle}
                value={opener.title}
                maxLength={DOC_LIMITS.headingLength}
                placeholder="Chapter title"
                aria-label="Opener title"
                onChange={(event) => onChange({ title: event.target.value })}
              />
              <input
                className={styles.openerSubtitle}
                value={opener.subtitle}
                maxLength={DOC_LIMITS.subtitleLength}
                placeholder="A line under the title (optional)"
                aria-label="Opener subtitle"
                onChange={(event) => onChange({ subtitle: event.target.value })}
              />
              {opener.image ? (
                <Plate
                  campaignId={campaignId}
                  image={opener.image}
                  imageAlt={opener.imageAlt}
                  uploading={image.uploading}
                  onReplace={image.pick}
                  onRemove={() => onStructuralChange({ image: null, imageAlt: "" })}
                  onAltChange={(imageAlt) => onChange({ imageAlt })}
                />
              ) : (
                <button type="button" className={styles.addElement} disabled={image.uploading} onClick={image.pick}>
                  <PlusIcon size={16} />
                  {image.uploading ? "Uploading…" : "Image"}
                  <span className={styles.addHint}>or drop one here</span>
                </button>
              )}
              {image.picker}
              {image.error ? (
                <p className={styles.fieldError} role="alert">
                  {image.error}
                </p>
              ) : null}
            </div>
          </section>

          <SoundBlock
            campaignId={campaignId}
            id={`opener-${chapter.id}`}
            page={opener}
            musicBefore={musicBefore}
            onChange={(patch) => onStructuralChange(patch)}
          />

          <section className={styles.notesBlock}>
            <div className={styles.notesLabel}>
              <label className={styles.eyebrow} htmlFor={`opener-notes-${chapter.id}`}>
                Speaker notes
              </label>
              <PrivateHint label="Only you see speaker notes" />
            </div>
            <textarea
              id={`opener-notes-${chapter.id}`}
              className={styles.notes}
              value={opener.notes}
              maxLength={DOC_LIMITS.notesLength}
              placeholder="What you want to say as this chapter begins"
              rows={3}
              onChange={(event) => onChange({ notes: event.target.value })}
            />
          </section>
        </>
      ) : (
        <div className={styles.openerEmpty}>
          <button type="button" className={styles.kindChoice} onClick={onAdd}>
            <span className={styles.kindChoiceTitle}>
              <OpenerIcon size={16} />
              Add a chapter opener
            </span>
            <span className={styles.kindChoiceText}>
              A title slide before this chapter&apos;s first page.
            </span>
          </button>
        </div>
      )}
    </article>
  );
}
