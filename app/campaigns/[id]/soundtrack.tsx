"use client";

import { useEffect, useRef } from "react";
import type { SoundRef } from "@/lib/campaign-doc";
import type { Slide } from "./slides";

const FADE_OUT_MS = 450;
const FADE_IN_MS = 900;
/** A volume change while playing: quick enough to follow a slider being dragged. */
const VOLUME_MS = 60;

export function slideSounds(s: Slide | undefined): { music: SoundRef | "stop" | null; effect: SoundRef | null } {
  const own = s?.kind === "page" ? s.page : s?.kind === "opener" ? s.chapter.opener : null;
  return { music: own?.music ?? null, effect: own?.effect ?? null };
}

/** The nearest slide at or before `index` that starts a track or stops the music. */
export function musicAt(slides: Slide[], index: number): SoundRef | null {
  for (let i = index; i >= 0; i--) {
    const { music } = slideSounds(slides[i]);
    if (music === null) continue;
    return music === "stop" ? null : music;
  }
  return null;
}

export function musicBySlide(slides: Slide[]): Map<string, SoundRef | null> {
  const out = new Map<string, SoundRef | null>();
  let now: SoundRef | null = null;
  for (const s of slides) {
    const { music } = slideSounds(s);
    if (music !== null) now = music === "stop" ? null : music;
    out.set(s.id, now);
  }
  return out;
}

/** The music already playing as each slide comes up (before its own sounds), in one pass. */
export function musicBeforeBySlide(slides: Slide[]): Map<string, SoundRef | null> {
  const out = new Map<string, SoundRef | null>();
  let now: SoundRef | null = null;
  for (const s of slides) {
    out.set(s.id, now);
    const { music } = slideSounds(s);
    if (music !== null) now = music === "stop" ? null : music;
  }
  return out;
}

const isVideoSlide = (s: Slide | undefined) => s?.kind === "page" && s.page.kind === "story" && s.page.video !== null;

/** If the browser refuses (no tap yet, e.g. after a refresh), retries on the first tap or key. */
function playSoon(el: HTMLAudioElement) {
  void el.play().catch(() => {
    const retry = () => {
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
      if (el.getAttribute("src")) void el.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", retry, { once: true });
    window.addEventListener("keydown", retry, { once: true });
  });
}

function fade(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const state = el as HTMLAudioElement & { _fade?: number };
  if (state._fade) cancelAnimationFrame(state._fade);
  const from = el.volume;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) state._fade = requestAnimationFrame(tick);
    else {
      state._fade = undefined;
      done?.();
    }
  };
  state._fade = requestAnimationFrame(tick);
}

/** Nothing plays until `enabled` (the sound gate the browser needs). */
export function Soundtrack({
  slides,
  current,
  mediaBase,
  enabled,
  music,
  effects,
}: {
  slides: Slide[];
  current: string | null;
  mediaBase: string;
  enabled: boolean;
  music: number;
  effects: number;
}) {
  const index = Math.max(0, slides.findIndex((s) => s.id === current));
  const track = enabled ? musicAt(slides, index) : null;
  const onVideo = isVideoSlide(slides[index]);
  const playing = useRef<{ file: string; el: HTMLAudioElement; level?: number } | null>(null);

  useEffect(() => {
    const now = playing.current;
    const target = track?.file ?? null;
    if (now && now.file !== target) {
      const old = now.el;
      fade(old, 0, FADE_OUT_MS, () => {
        old.pause();
        old.removeAttribute("src");
        old.load();
      });
      playing.current = null;
    }
    if (!target) return;
    let cur = playing.current;
    if (!cur) {
      const el = new Audio(`${mediaBase}/sounds/${target}`);
      el.loop = true;
      el.volume = 0;
      cur = playing.current = { file: target, el };
    }
    const el = cur.el;
    if (onVideo) {
      fade(el, 0, FADE_OUT_MS, () => el.pause());
    } else if (!el.paused && cur.level !== undefined) {
      // Already playing at a level: a volume change (dragging the slider) follows at once.
      fade(el, music, VOLUME_MS);
    } else {
      playSoon(el);
      fade(el, music, FADE_IN_MS);
    }
    cur.level = onVideo ? undefined : music;
  }, [track?.file, onVideo, music, mediaBase]);

  useEffect(
    () => () => {
      const el = playing.current?.el;
      if (el) {
        el.pause();
        el.removeAttribute("src");
      }
      playing.current = null;
    },
    [],
  );

  const slide = slides[index];
  const effectFile = enabled ? (slideSounds(slide).effect?.file ?? null) : null;
  const slideId = slide?.id ?? null;
  const effectsRef = useRef(effects);
  useEffect(() => {
    effectsRef.current = effects;
  }, [effects]);
  useEffect(() => {
    if (!effectFile || effectsRef.current <= 0) return;
    const el = new Audio(`${mediaBase}/sounds/${effectFile}`);
    el.volume = Math.min(1, effectsRef.current);
    void el.play().catch(() => undefined); // A one-off: if the browser refuses, it's skipped rather than played late.
    return () => {
      // Leaving the slide cuts a long effect short rather than letting it trail into the next one.
      fade(el, 0, 250, () => el.pause());
    };
  }, [slideId, effectFile, mediaBase]);

  return null;
}
