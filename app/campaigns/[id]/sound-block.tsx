"use client";

import { useEffect, useRef, useState } from "react";
import { DOC_LIMITS, SOUND_MAX_BYTES, SOUND_TYPES, type SoundRef } from "@/lib/campaign-doc";
import { MusicIcon, PlayIcon, PlusIcon, SoundIcon, StopIcon } from "../../icons";
import { Tooltip } from "../../tooltip";
import styles from "./editor.module.css";

const ACCEPT = Object.keys(SOUND_TYPES).join(",") + ",.mp3,.m4a,.ogg,.wav";
const FAILED = "The upload didn't go through. Try again.";

const labelOf = (file: File) => file.name.replace(/\.[^.]+$/, "").trim().slice(0, DOC_LIMITS.soundLabel) || "Sound";

/**
 * XHR for progress; the server re-checks size and type. `onUploaded` is captured at start, so a
 * mid-upload page switch lands it where it began.
 */
function useSoundUpload(campaignId: string, onUploaded: (sound: SoundRef) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function upload(file: File) {
    setError(null);
    const okType = file.type in SOUND_TYPES || /\.(mp3|m4a|ogg|wav)$/i.test(file.name);
    if (!okType) return setError("Use an MP3, M4A, OGG or WAV file");
    if (file.size > SOUND_MAX_BYTES) return setError("Sounds can be up to 20 MB");
    const done = onUploaded;
    const label = labelOf(file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/uploads/sound/${campaignId}`);
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
      if (xhr.status === 200 && body?.name) done({ file: body.name, label });
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
  return { pick: () => inputRef.current?.click(), picker, uploading: progress !== null, progress, error };
}

function SoundPlate({
  campaignId,
  sound,
  icon,
  uploading,
  progress,
  onReplace,
  onRemove,
}: {
  campaignId: string;
  sound: SoundRef;
  icon: React.ReactNode;
  uploading: boolean;
  progress: number | null;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [listening, setListening] = useState(false);
  useEffect(
    () => () => {
      audio.current?.pause();
      audio.current = null;
    },
    [sound.file],
  );
  function toggle() {
    if (listening) {
      audio.current?.pause();
      setListening(false);
      return;
    }
    const el = new Audio(`/campaigns/${campaignId}/sounds/${sound.file}`);
    el.onended = () => setListening(false);
    audio.current = el;
    void el.play().then(
      () => setListening(true),
      () => setListening(false),
    );
  }
  return (
    <div className={styles.soundPlate}>
      <Tooltip content={listening ? "Stop" : "Listen"} side="top">
        <button type="button" className={styles.soundListen} aria-label={listening ? "Stop" : "Listen"} onClick={toggle}>
          {listening ? <StopIcon size={16} /> : <PlayIcon size={16} />}
        </button>
      </Tooltip>
      <span className={styles.soundName}>
        {icon}
        {sound.label || "Sound"}
      </span>
      <button type="button" className={styles.soundAction} onClick={onReplace} disabled={uploading}>
        {uploading ? `Uploading… ${progress ?? 0}%` : "Replace"}
      </button>
      <button type="button" className={styles.soundAction} onClick={onRemove} disabled={uploading}>
        Remove
      </button>
    </div>
  );
}

type SoundOwner = { music: SoundRef | "stop" | null; effect: SoundRef | null };

/** Music: carry on, start a track here (it plays across later slides until changed), or stop. Effect: plays once when the slide comes up. */
export function SoundBlock({
  campaignId,
  id,
  page,
  musicBefore,
  onChange,
}: {
  campaignId: string;
  id: string;
  page: SoundOwner;
  musicBefore: SoundRef | null;
  onChange: (patch: Partial<SoundOwner>) => void;
}) {
  const music = useSoundUpload(campaignId, (sound) => onChange({ music: sound }));
  const effect = useSoundUpload(campaignId, (sound) => onChange({ effect: sound }));
  const track = page.music && page.music !== "stop" ? page.music : null;
  const mode = page.music === null ? "carry" : page.music === "stop" ? "stop" : "new";

  return (
    <section className={styles.soundBlock} aria-labelledby={`sound-${id}`}>
      <p id={`sound-${id}`} className={styles.eyebrow}>
        Sound
      </p>
      <div className={styles.soundRow}>
        <span className={styles.soundKind} id={`music-${id}`}>
          Music
        </span>
        <div className={styles.segmented} role="radiogroup" aria-labelledby={`music-${id}`}>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "carry"}
            className={styles.segment}
            onClick={() => onChange({ music: null })}
          >
            Carry on
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "new"}
            className={styles.segment}
            onClick={() => (track ? undefined : music.pick())}
            disabled={music.uploading}
          >
            {music.uploading && !track ? `Uploading… ${music.progress ?? 0}%` : "New track"}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "stop"}
            className={styles.segment}
            // Nothing playing yet: there's nothing to stop.
            disabled={!musicBefore && mode !== "stop"}
            onClick={() => onChange({ music: "stop" })}
          >
            Stop
          </button>
        </div>
        {mode === "carry" ? (
          <span className={styles.soundHint}>
            <MusicIcon size={14} aria-hidden />
            {musicBefore ? musicBefore.label || "Sound" : "None"}
          </span>
        ) : null}
      </div>
      {track ? (
        <SoundPlate
          campaignId={campaignId}
          sound={track}
          icon={<MusicIcon size={14} aria-hidden />}
          uploading={music.uploading}
          progress={music.progress}
          onReplace={music.pick}
          onRemove={() => onChange({ music: null })}
        />
      ) : null}
      {music.picker}
      {music.error ? (
        <p className={styles.fieldError} role="alert">
          {music.error}
        </p>
      ) : null}

      <div className={styles.soundRow}>
        <span className={styles.soundKind}>Effect</span>
        {page.effect ? (
          <SoundPlate
            campaignId={campaignId}
            sound={page.effect}
            icon={<SoundIcon size={14} aria-hidden />}
            uploading={effect.uploading}
            progress={effect.progress}
            onReplace={effect.pick}
            onRemove={() => onChange({ effect: null })}
          />
        ) : (
          <button type="button" className={styles.soundAdd} onClick={effect.pick} disabled={effect.uploading}>
            <PlusIcon size={14} aria-hidden />
            {effect.uploading ? `Uploading… ${effect.progress ?? 0}%` : "Sound effect"}
          </button>
        )}
      </div>
      {effect.picker}
      {effect.error ? (
        <p className={styles.fieldError} role="alert">
          {effect.error}
        </p>
      ) : null}
    </section>
  );
}
