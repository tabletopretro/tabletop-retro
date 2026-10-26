"use client";

import { useRef, useState } from "react";
import { VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/campaign-doc";
import styles from "./editor.module.css";

const ACCEPT = Object.keys(VIDEO_TYPES).join(",");
const FAILED = "The upload didn't go through. Try again.";

/**
 * XHR rather than fetch, for progress. `onUploaded` is captured at start, so a mid-upload page
 * switch lands it where it was added.
 */
export function useVideoUpload(campaignId: string, onUploaded: (name: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    if (!(file.type in VIDEO_TYPES)) return setError("Use an MP4, WebM or MOV video");
    if (file.size > VIDEO_MAX_BYTES) return setError("Videos can be up to 100 MB");
    const done = onUploaded;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/uploads/video/${campaignId}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      let body: { name?: string; error?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Not JSON: fall through to the generic message.
      }
      if (xhr.status === 200 && body?.name) done(body.name);
      else setError(body?.error ?? FAILED);
    };
    xhr.onerror = () => {
      setProgress(null);
      setError(FAILED);
    };
    setProgress(0);
    xhr.send(file);
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
        if (file) upload(file);
      }}
    />
  );

  return {
    pick: () => inputRef.current?.click(),
    picker,
    upload,
    uploading: progress !== null,
    progress,
    error,
  };
}

export const isVideoFile = (file: File) => file.type in VIDEO_TYPES;

export function VideoPlate({
  campaignId,
  video,
  autoplay,
  uploading,
  progress,
  onReplace,
  onRemove,
  onAutoplayChange,
}: {
  campaignId: string;
  video: string;
  autoplay: boolean;
  uploading: boolean;
  progress: number | null;
  onReplace: () => void;
  onRemove: () => void;
  onAutoplayChange: (autoplay: boolean) => void;
}) {
  return (
    <div className={styles.imageSlot}>
      <figure className={styles.plate} aria-busy={uploading}>
        <video
          key={video}
          src={`/campaigns/${campaignId}/videos/${video}`}
          className={styles.plateImage}
          controls
          preload="metadata"
          playsInline
        />
        <div className={styles.plateActions}>
          <button type="button" className={styles.chip} onClick={onReplace} disabled={uploading}>
            {uploading ? `Uploading… ${progress ?? 0}%` : "Replace"}
          </button>
          <button type="button" className={styles.chip} onClick={onRemove} disabled={uploading}>
            Remove
          </button>
        </div>
      </figure>
      <div className={styles.videoSetting}>
        <span className={styles.eyebrow} id={`plays-${video}`}>
          Plays
        </span>
        <div className={styles.segmented} role="radiogroup" aria-labelledby={`plays-${video}`}>
          <button
            type="button"
            role="radio"
            aria-checked={autoplay}
            className={styles.segment}
            onClick={() => onAutoplayChange(true)}
          >
            When the slide shows
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!autoplay}
            className={styles.segment}
            onClick={() => onAutoplayChange(false)}
          >
            When you press play
          </button>
        </div>
      </div>
    </div>
  );
}
