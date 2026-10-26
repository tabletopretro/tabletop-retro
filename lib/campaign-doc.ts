/**
 * Shared by client and server: no Node APIs. `parseCampaignDoc` is the only way data becomes
 * a CampaignDoc; new fields need a parser default so older files still open.
 */

import { activityHasContent as registryHasContent, activityImages, parseActivity } from "@/activities";
import type { ActivityConfig } from "@/activities/types";
import { CHARACTER_ID_PATTERN } from "./character-doc";

export const PAGE_KINDS = ["story", "activity", "speech"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

/** Parsed by the registry (activities/index.ts). */
export type Activity = ActivityConfig;

export function activityHasContent(activity: Activity | null) {
  return registryHasContent(activity);
}

export const HEADING_REVEALS = [0, 1, 2, 3, 5] as const;

export type CampaignPage = {
  /** Stable identity; titles and positions change, this doesn't. */
  id: string;
  /** TL-only page name; players see `heading`. */
  title: string;
  kind: PageKind | null;
  activity: Activity | null;
  /** Player-facing; always rendered above the image. */
  heading: string;
  /** Seconds the heading takes to fade in; 0 is no effect. */
  headingReveal: number;
  headingRevealBy: "letter" | "whole";
  /** Speaker notes; never sent to players. */
  notes: string;
  image: string | null;
  imageAlt: string;
  text: string;
  video: string | null;
  videoAutoplay: boolean;
  /** Music from this slide on, looping until another page changes it; null carries on. */
  music: SoundRef | "stop" | null;
  effect: SoundRef | null;
  /** Kept when the speaker leaves the cast or is deleted. */
  speakerId: string | null;
  line: string;
};

/** A sound in the campaign's sounds/ folder, with the name the TL uploaded it under. */
export type SoundRef = { file: string; label: string };

export type ChapterOpener = {
  title: string;
  subtitle: string;
  image: string | null;
  imageAlt: string;
  notes: string;
  music: SoundRef | "stop" | null;
  effect: SoundRef | null;
};

export type CampaignChapter = {
  id: string;
  title: string;
  opener: ChapterOpener | null;
  pages: CampaignPage[];
};

export type CampaignDoc = {
  version: 1;
  title: string;
  /** Ids of the owner's characters, in the TL's order. */
  cast: string[];
  chapters: CampaignChapter[];
};

export const CAMPAIGN_TITLE_MAX = 60;

export function normalizeCampaignTitle(raw: string): string | null {
  const title = raw.replace(/\s+/g, " ").trim();
  if (!title || title.length > CAMPAIGN_TITLE_MAX) return null;
  return title;
}

export const DOC_LIMITS = {
  chapters: 50,
  pagesPerChapter: 100,
  titleLength: 80,
  headingLength: 120,
  subtitleLength: 200,
  cast: 100,
  lineLength: 1000,
  altLength: 200,
  textLength: 4000,
  notesLength: 4000,
  soundLabel: 80,
} as const;

export const IMAGE_TYPES = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
} as const;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_NAME_PATTERN = /^[a-f0-9]{32}\.(webp|png|jpg|gif)$/;

/** Too large for a server action: uploaded through a streaming route. */
export const VIDEO_TYPES = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
} as const;
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_NAME_PATTERN = /^[a-f0-9]{32}\.(mp4|webm|mov)$/;

export const SOUND_TYPES = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
} as const;
export const SOUND_MAX_BYTES = 20 * 1024 * 1024;
export const SOUND_NAME_PATTERN = /^[a-f0-9]{32}\.(mp3|m4a|ogg|wav)$/;

const ID_PATTERN = /^[a-z0-9]{10}$/;

export function newDocId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

export function blankPage(): CampaignPage {
  return {
    id: newDocId(),
    title: "",
    kind: null,
    activity: null,
    heading: "",
    headingReveal: 0,
    headingRevealBy: "letter",
    notes: "",
    image: null,
    imageAlt: "",
    text: "",
    video: null,
    videoAutoplay: false,
    music: null,
    effect: null,
    speakerId: null,
    line: "",
  };
}

/** Never put the number in the title: chapters move, so "Chapter 3" would go stale. The outline shows the position. */
export const NEW_CHAPTER_TITLE = "New chapter";

export function blankChapter(): CampaignChapter {
  return { id: newDocId(), title: NEW_CHAPTER_TITLE, opener: null, pages: [blankPage()] };
}

export function blankOpener(chapterTitle: string): ChapterOpener {
  const title = chapterTitle.trim() === NEW_CHAPTER_TITLE ? "" : chapterTitle.trim();
  return { title: title.slice(0, DOC_LIMITS.headingLength), subtitle: "", image: null, imageAlt: "", notes: "", music: null, effect: null };
}

/** Page and chapter ids are [a-z0-9]{10}, so "opener:<id>" can't collide with one. */
export const openerSelection = (chapterId: string) => `opener:${chapterId}`;
export const openerChapterId = (selection: string | null) =>
  selection?.startsWith("opener:") ? selection.slice("opener:".length) : null;

export function docVideos(doc: CampaignDoc): string[] {
  return doc.chapters.flatMap((c) => c.pages.flatMap((p) => (p.video ? [p.video] : [])));
}

/** Every sound the doc references, music and effects, openers included. */
export function docSounds(doc: CampaignDoc): string[] {
  const of = (x: { music: SoundRef | "stop" | null; effect: SoundRef | null }) => [
    ...(x.music && x.music !== "stop" ? [x.music.file] : []),
    ...(x.effect ? [x.effect.file] : []),
  ];
  return doc.chapters.flatMap((c) => [...(c.opener ? of(c.opener) : []), ...c.pages.flatMap(of)]);
}

/** Every image the doc references: pages, openers and activities. Anything new that holds an image must be counted here, or saves prune it. */
export function docImages(doc: CampaignDoc): string[] {
  const names: string[] = [];
  for (const c of doc.chapters) {
    if (c.opener?.image) names.push(c.opener.image);
    for (const p of c.pages) {
      if (p.image) names.push(p.image);
      if (p.activity) names.push(...activityImages(p.activity));
    }
  }
  return names;
}

export function starterDoc(title: string): CampaignDoc {
  return { version: 1, title, cast: [], chapters: [blankChapter()] };
}

/**
 * Moves a page to `toIndex` in `toChapterId`, where the index counts the
 * target list as it is now, before the page leaves its old spot. Returns
 * the doc unchanged when the move is a no-op or would overfill a chapter.
 */
export function movePage(
  doc: CampaignDoc,
  pageId: string,
  toChapterId: string,
  toIndex: number,
): CampaignDoc {
  const fromCi = doc.chapters.findIndex((c) => c.pages.some((p) => p.id === pageId));
  const toCi = doc.chapters.findIndex((c) => c.id === toChapterId);
  if (fromCi === -1 || toCi === -1) return doc;
  const fromPi = doc.chapters[fromCi].pages.findIndex((p) => p.id === pageId);
  let index = Math.max(0, Math.min(toIndex, doc.chapters[toCi].pages.length));
  if (fromCi === toCi) {
    if (index > fromPi) index -= 1;
    if (index === fromPi) return doc;
  } else if (doc.chapters[toCi].pages.length >= DOC_LIMITS.pagesPerChapter) {
    return doc;
  }
  const page = doc.chapters[fromCi].pages[fromPi];
  const chapters = doc.chapters.map((c) => ({ ...c, pages: c.pages.filter((p) => p.id !== pageId) }));
  chapters[toCi].pages.splice(index, 0, page);
  return { ...doc, chapters };
}

/** Same index convention as movePage. */
export function moveChapter(doc: CampaignDoc, chapterId: string, toIndex: number): CampaignDoc {
  const from = doc.chapters.findIndex((c) => c.id === chapterId);
  if (from === -1) return doc;
  let index = Math.max(0, Math.min(toIndex, doc.chapters.length));
  if (index > from) index -= 1;
  if (index === from) return doc;
  const chapters = doc.chapters.filter((c) => c.id !== chapterId);
  chapters.splice(index, 0, doc.chapters[from]);
  return { ...doc, chapters };
}

export function pageHasContent(page: CampaignPage) {
  return (
    page.image !== null ||
    page.video !== null ||
    page.music !== null ||
    page.effect !== null ||
    page.text.trim() !== "" ||
    page.title.trim() !== "" ||
    page.heading.trim() !== "" ||
    page.notes.trim() !== "" ||
    page.line.trim() !== "" ||
    page.kind === "activity" ||
    page.kind === "speech"
  );
}

function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

/** A sound reference, or null; undefined when it's malformed. */
function soundRef(value: unknown): SoundRef | null | undefined {
  if (value == null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v !== "object" || typeof v.file !== "string" || !SOUND_NAME_PATTERN.test(v.file)) return undefined;
  const label = typeof v.label === "string" ? v.label.slice(0, DOC_LIMITS.soundLabel) : "";
  return { file: v.file, label };
}

function parsePage(raw: unknown): CampaignPage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && ID_PATTERN.test(r.id) ? r.id : null;
  const title = str(r.title ?? "", DOC_LIMITS.titleLength);
  const imageAlt = str(r.imageAlt ?? "", DOC_LIMITS.altLength);
  const text = str(r.text ?? "", DOC_LIMITS.textLength);
  const heading = str(r.heading ?? "", DOC_LIMITS.headingLength);
  // Older files have no reveal; an unknown length falls back to none.
  const headingReveal = (HEADING_REVEALS as readonly unknown[]).includes(r.headingReveal) ? (r.headingReveal as number) : 0;
  const headingRevealBy = r.headingRevealBy === "whole" ? ("whole" as const) : ("letter" as const);
  const notes = str(r.notes ?? "", DOC_LIMITS.notesLength);
  const activity = parseActivity(r.activity);
  const line = str(r.line ?? "", DOC_LIMITS.lineLength);
  const video =
    r.video == null ? null : typeof r.video === "string" && VIDEO_NAME_PATTERN.test(r.video) ? r.video : undefined;
  if (r.videoAutoplay !== undefined && typeof r.videoAutoplay !== "boolean") return null;
  const videoAutoplay = r.videoAutoplay === true;
  // Older pages have no sounds.
  const music = r.music === "stop" ? ("stop" as const) : soundRef(r.music);
  const effect = soundRef(r.effect);
  const speakerId =
    r.speakerId == null
      ? null
      : typeof r.speakerId === "string" && CHARACTER_ID_PATTERN.test(r.speakerId)
        ? r.speakerId
        : undefined;
  // Pages saved before kinds existed were all story pages.
  const kind =
    r.kind === undefined ? "story" : r.kind === null ? null : (PAGE_KINDS.find((k) => k === r.kind) ?? undefined);
  const image =
    r.image == null
      ? null
      : typeof r.image === "string" && IMAGE_NAME_PATTERN.test(r.image)
        ? r.image
        : undefined;
  if (
    !id ||
    title === null ||
    heading === null ||
    notes === null ||
    kind === undefined ||
    activity === undefined ||
    imageAlt === null ||
    text === null ||
    image === undefined ||
    line === null ||
    speakerId === undefined ||
    video === undefined ||
    music === undefined ||
    effect === undefined
  ) {
    return null;
  }
  // A `headingPlacement` from older files is ignored: headings are always above.
  return {
    id,
    title,
    kind,
    activity,
    heading,
    headingReveal,
    headingRevealBy,
    notes,
    image,
    imageAlt,
    text,
    video,
    videoAutoplay,
    music,
    effect,
    speakerId,
    line,
  };
}

function imageName(value: unknown): string | null | undefined {
  if (value == null) return null;
  return typeof value === "string" && IMAGE_NAME_PATTERN.test(value) ? value : undefined;
}

/** Undefined when malformed; null when the chapter has no opener. */
function parseOpener(raw: unknown): ChapterOpener | null | undefined {
  if (raw == null) return null;
  if (typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const title = str(r.title ?? "", DOC_LIMITS.headingLength);
  const subtitle = str(r.subtitle ?? "", DOC_LIMITS.subtitleLength);
  const imageAlt = str(r.imageAlt ?? "", DOC_LIMITS.altLength);
  const notes = str(r.notes ?? "", DOC_LIMITS.notesLength);
  const image = imageName(r.image);
  // Older openers have no sounds.
  const music = r.music === "stop" ? ("stop" as const) : soundRef(r.music);
  const effect = soundRef(r.effect);
  if (
    title === null ||
    subtitle === null ||
    imageAlt === null ||
    notes === null ||
    image === undefined ||
    music === undefined ||
    effect === undefined
  ) {
    return undefined;
  }
  return { title, subtitle, image, imageAlt, notes, music, effect };
}

function parseChapter(raw: unknown): CampaignChapter | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && ID_PATTERN.test(r.id) ? r.id : null;
  const title = str(r.title ?? "", DOC_LIMITS.titleLength);
  const opener = parseOpener(r.opener);
  if (!id || title === null || opener === undefined || !Array.isArray(r.pages)) return null;
  if (r.pages.length > DOC_LIMITS.pagesPerChapter) return null;
  const pages = r.pages.map(parsePage);
  if (pages.some((p) => p === null)) return null;
  return { id, title, opener, pages: pages as CampaignPage[] };
}

/** Null if anything is malformed, over a limit, or ids repeat. */
export function parseCampaignDoc(raw: unknown, title: string): CampaignDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.chapters) || r.chapters.length > DOC_LIMITS.chapters) return null;
  const chapters = r.chapters.map(parseChapter);
  if (chapters.some((c) => c === null)) return null;

  const ids = new Set<string>();
  for (const chapter of chapters as CampaignChapter[]) {
    for (const id of [chapter.id, ...chapter.pages.map((p) => p.id)]) {
      if (ids.has(id)) return null;
      ids.add(id);
    }
  }
  const cast = parseCast(r.cast);
  if (!cast) return null;
  return { version: 1, title, cast, chapters: chapters as CampaignChapter[] };
}

/**
 * Well-formed, unique character ids; older files have no cast. Whether
 * each id is the owner's is checked on save (lib/characters.ts), not here.
 */
function parseCast(raw: unknown): string[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > DOC_LIMITS.cast) return null;
  if (!raw.every((id) => typeof id === "string" && CHARACTER_ID_PATTERN.test(id))) return null;
  return [...new Set(raw as string[])];
}
