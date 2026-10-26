"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import styles from "./play.module.css";

/** Kept in localStorage, this browser only. */
export type SoundPrefs = {
  muted: boolean;
  video: number;
  music: number;
  effects: number;
  /** Set once the sound screen has been answered; it isn't asked again. */
  chosen: boolean;
};

const DEFAULTS: SoundPrefs = { muted: false, video: 0.8, music: 0.5, effects: 0.7, chosen: false };
const KEY = "tr_sound";
const EVENT = "tr-sound-change";

let cached: SoundPrefs | null = null;

function read(): SoundPrefs {
  if (cached) return cached;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    cached = { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch {
    cached = DEFAULTS;
  }
  return cached as SoundPrefs;
}

export function setSoundPrefs(next: SoundPrefs) {
  cached = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the choice still applies for this visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Server render and first client render both get DEFAULTS, so hydration matches. */
export function useSoundPrefs(): SoundPrefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}

export const videoVolume = (prefs: SoundPrefs) => (prefs.muted ? 0 : prefs.video);
export const musicVolume = (prefs: SoundPrefs) => (prefs.muted ? 0 : prefs.music);
export const effectsVolume = (prefs: SoundPrefs) => (prefs.muted ? 0 : prefs.effects);

/** With `gate`, this is also the tap browsers need before playing sound. */
export function SettingsPanel({ open, gate, onClose }: { open: boolean; gate: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const prefs = useSoundPrefs();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  function unlockAndClose(muted: boolean) {
    setSoundPrefs({ ...prefs, muted, chosen: true });
    // Resuming a context inside the gesture also unlocks Web Audio for the soundtrack.
    try {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) void new Context().resume();
    } catch {
      // No Web Audio: media elements still play after this tap.
    }
    onClose();
  }

  const slider = (key: "video" | "music" | "effects", label: string) => (
    <label className={styles.soundRow}>
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={prefs[key]}
        disabled={prefs.muted}
        onChange={(event) => setSoundPrefs({ ...prefs, [key]: Number(event.target.value) })}
      />
    </label>
  );

  return (
    <dialog
      ref={ref}
      className={styles.soundDialog}
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!gate) onClose();
      }}
    >
      <h2 id="settings-title" className={styles.soundTitle}>
        {gate ? "Sound" : "Settings"}
      </h2>
      <section className={styles.settingsSection} aria-labelledby={gate ? undefined : "settings-sound"}>
        {gate ? null : (
          <h3 id="settings-sound" className={styles.settingsLabel}>
            Sound
          </h3>
        )}
        {slider("video", "Video")}
        {slider("music", "Music")}
        {slider("effects", "Effects")}
        <label className={styles.soundMute}>
          <input
            type="checkbox"
            checked={prefs.muted}
            onChange={(event) => setSoundPrefs({ ...prefs, muted: event.target.checked })}
          />
          Mute everything
        </label>
      </section>
      {gate ? <p className={styles.later}>You can change this later in Settings.</p> : null}
      <div className={styles.soundActions}>
        {gate ? (
          <>
            <button type="button" className={styles.quiet} onClick={() => unlockAndClose(true)}>
              No sound
            </button>
            <button type="button" className={styles.sit} onClick={() => unlockAndClose(false)} autoFocus>
              Turn on sound
            </button>
          </>
        ) : (
          <button type="button" className={styles.sit} onClick={onClose}>
            Done
          </button>
        )}
      </div>
    </dialog>
  );
}
