import "server-only";
import {
  closeSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import path from "node:path";
import { and, eq, ne } from "drizzle-orm";
import { CONTENT_DIR, db, schema } from "@/db";
import {
  docImages,
  docSounds,
  docVideos,
  IMAGE_NAME_PATTERN,
  SOUND_MAX_BYTES,
  SOUND_NAME_PATTERN,
  VIDEO_MAX_BYTES,
  VIDEO_NAME_PATTERN,
  parseCampaignDoc,
  starterDoc,
  type CampaignDoc,
} from "./campaign-doc";

/** The folder name is generated, never user input, so a title can't steer a write outside CAMPAIGNS_DIR. */
export const CAMPAIGNS_DIR = path.join(CONTENT_DIR, "campaigns");
export { CAMPAIGN_TITLE_MAX, normalizeCampaignTitle } from "./campaign-doc";

/** Unreferenced images younger than this survive a prune, so an in-flight save can't sweep a fresh upload. */
const ORPHAN_GRACE_MS = 10 * 60 * 1000;

const folderFor = (contentPath: string) => path.join(CAMPAIGNS_DIR, contentPath);
const docFileFor = (contentPath: string) => path.join(folderFor(contentPath), "campaign.json");
const imagesDirFor = (contentPath: string) => path.join(folderFor(contentPath), "images");
const videosDirFor = (contentPath: string) => path.join(folderFor(contentPath), "videos");
const soundsDirFor = (contentPath: string) => path.join(folderFor(contentPath), "sounds");

function contentPathFor(title: string) {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "campaign";
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
}

const titleKey = (title: string) => title.replace(/\s+/g, " ").trim().toLocaleLowerCase();

/** Case- and spacing-insensitive, within one owner's library only. */
export function titleTaken(ownerId: string, title: string, exceptId?: string) {
  const wanted = titleKey(title);
  return db
    .select({ title: schema.campaigns.title })
    .from(schema.campaigns)
    .where(
      exceptId
        ? and(eq(schema.campaigns.ownerId, ownerId), ne(schema.campaigns.id, exceptId))
        : eq(schema.campaigns.ownerId, ownerId),
    )
    .all()
    .some((row) => titleKey(row.title) === wanted);
}

/** Write to a temp file and rename, so a crash never leaves half a doc. */
function writeDoc(contentPath: string, doc: CampaignDoc) {
  const file = docFileFor(contentPath);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(doc, null, 2)}\n`);
  renameSync(temp, file);
}

export type CreateResult = { id: string } | { error: "taken" };

/**
 * The title check and the insert share one synchronous better-sqlite3
 * transaction, which is what makes uniqueness safe in a single process.
 * Row and folder land together or not at all.
 */
export function createCampaign(ownerId: string, title: string): CreateResult {
  const contentPath = contentPathFor(title);
  try {
    return db.transaction((tx) => {
      if (titleTaken(ownerId, title)) return { error: "taken" as const };
      const row = tx
        .insert(schema.campaigns)
        .values({ ownerId, title, contentPath })
        .returning({ id: schema.campaigns.id })
        .get();
      mkdirSync(folderFor(contentPath), { recursive: true });
      writeDoc(contentPath, starterDoc(title));
      return row;
    });
  } catch (error) {
    rmSync(folderFor(contentPath), { recursive: true, force: true });
    throw error;
  }
}

export function campaignForOwner(campaignId: string, ownerId: string) {
  return (
    db
      .select({
        id: schema.campaigns.id,
        title: schema.campaigns.title,
        contentPath: schema.campaigns.contentPath,
      })
      .from(schema.campaigns)
      .where(and(eq(schema.campaigns.id, campaignId), eq(schema.campaigns.ownerId, ownerId)))
      .get() ?? null
  );
}

export type OwnedCampaign = NonNullable<ReturnType<typeof campaignForOwner>>;

/**
 * Any campaign by id, owner or not. Only for callers that have already
 * checked access another way (a player's seat at the campaign's table).
 */
export function campaignById(campaignId: string): OwnedCampaign | null {
  return (
    db
      .select({
        id: schema.campaigns.id,
        title: schema.campaigns.title,
        contentPath: schema.campaigns.contentPath,
      })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, campaignId))
      .get() ?? null
  );
}

/** A missing or unreadable file opens as an empty campaign, not an error. */
export function readCampaignDoc(campaign: OwnedCampaign): CampaignDoc {
  try {
    const raw: unknown = JSON.parse(readFileSync(docFileFor(campaign.contentPath), "utf8"));
    return parseCampaignDoc(raw, campaign.title) ?? { version: 1, title: campaign.title, cast: [], chapters: [] };
  } catch {
    return { version: 1, title: campaign.title, cast: [], chapters: [] };
  }
}

/** `keep`: images unreferenced by `doc` that must survive the prune (undo). */
export function saveCampaignDoc(campaign: OwnedCampaign, doc: CampaignDoc, keep: string[] = []) {
  mkdirSync(folderFor(campaign.contentPath), { recursive: true });
  writeDoc(campaign.contentPath, { ...doc, title: campaign.title });
  db.update(schema.campaigns)
    .set({ updatedAt: new Date() })
    .where(eq(schema.campaigns.id, campaign.id))
    .run();
  pruneImages(campaign.contentPath, doc, keep);
  pruneVideos(campaign.contentPath, doc, keep);
  pruneSounds(campaign.contentPath, doc, keep);
}

export type RenameResult = { title: string } | { error: "taken" };

export function renameCampaign(campaign: OwnedCampaign, ownerId: string, title: string): RenameResult {
  return db.transaction((tx) => {
    if (titleTaken(ownerId, title, campaign.id)) return { error: "taken" as const };
    tx.update(schema.campaigns)
      .set({ title, updatedAt: new Date() })
      .where(eq(schema.campaigns.id, campaign.id))
      .run();
    const doc = readCampaignDoc(campaign);
    writeDoc(campaign.contentPath, { ...doc, title });
    return { title };
  });
}

export type DeleteResult = { ok: true } | { error: "has-tables" };

/** Refuses while any table points at the campaign; those keep history. */
export function deleteCampaign(campaign: OwnedCampaign): DeleteResult {
  const result = db.transaction((tx) => {
    const table = tx
      .select({ id: schema.tables.id })
      .from(schema.tables)
      .where(eq(schema.tables.campaignId, campaign.id))
      .limit(1)
      .get();
    if (table) return { error: "has-tables" as const };
    tx.delete(schema.campaigns).where(eq(schema.campaigns.id, campaign.id)).run();
    return { ok: true as const };
  });
  if ("ok" in result) rmSync(folderFor(campaign.contentPath), { recursive: true, force: true });
  return result;
}

/** Sniff the bytes rather than trusting the browser's claimed type. */
export function detectImageType(bytes: Uint8Array): "webp" | "png" | "jpg" | "gif" | null {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

export function saveCampaignImage(campaign: OwnedCampaign, bytes: Uint8Array, ext: string) {
  const name = `${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
  mkdirSync(imagesDirFor(campaign.contentPath), { recursive: true });
  writeFileSync(path.join(imagesDirFor(campaign.contentPath), name), bytes);
  return name;
}

/** Null for any name that isn't one we generated. */
export function campaignImagePath(campaign: OwnedCampaign, name: string) {
  if (!IMAGE_NAME_PATTERN.test(name)) return null;
  return path.join(imagesDirFor(campaign.contentPath), name);
}

function pruneImages(contentPath: string, doc: CampaignDoc, keep: string[]) {
  const dir = imagesDirFor(contentPath);
  // Openers' images count as used too, not just pages'.
  const used = new Set<string>([...docImages(doc), ...keep]);
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return;
  }
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  for (const file of files) {
    if (used.has(file) || !IMAGE_NAME_PATTERN.test(file)) continue;
    const full = path.join(dir, file);
    if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
  }
}

/** Sniff the container from the first bytes; the browser's claimed type isn't trusted. */
export function detectVideoType(head: Uint8Array): "mp4" | "webm" | "mov" | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...head.subarray(start, end));
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
  if (ascii(4, 8) === "ftyp") return ascii(8, 12) === "qt  " ? "mov" : "mp4";
  return null;
}

export type VideoSaveResult = { name: string } | { error: "too-large" | "unsupported" };

/**
 * Streams an upload to disk, never holding it in memory, and stops past
 * `max` bytes. The type is sniffed from the first bytes; the file gets
 * its final name only once complete and valid.
 */
async function streamUpload(
  dir: string,
  body: ReadableStream<Uint8Array>,
  max: number,
  detect: (head: Uint8Array) => string | null,
): Promise<VideoSaveResult> {
  mkdirSync(dir, { recursive: true });
  const id = crypto.randomUUID().replace(/-/g, "");
  const temp = path.join(dir, `${id}.part`);
  const fd = openSync(temp, "w");
  let size = 0;
  let head: Uint8Array | null = null;
  let failure: "too-large" | "unsupported" | null = null;
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        failure = "too-large";
        break;
      }
      if (!head) head = value.subarray(0, 16);
      writeSync(fd, value);
    }
  } finally {
    closeSync(fd);
    if (failure) await reader.cancel().catch(() => undefined);
  }
  const ext = !failure && head ? detect(head) : null;
  if (failure || !ext) {
    unlinkSync(temp);
    return { error: failure ?? "unsupported" };
  }
  const name = `${id}.${ext}`;
  renameSync(temp, path.join(dir, name));
  return { name };
}

/** `max` can be lowered to the owner's remaining storage. */
export function saveCampaignVideo(
  campaign: OwnedCampaign,
  body: ReadableStream<Uint8Array>,
  max = VIDEO_MAX_BYTES,
): Promise<VideoSaveResult> {
  return streamUpload(videosDirFor(campaign.contentPath), body, Math.min(max, VIDEO_MAX_BYTES), detectVideoType);
}

/** Null for any name that isn't one we generated. */
export function campaignVideoPath(campaign: OwnedCampaign, name: string) {
  if (!VIDEO_NAME_PATTERN.test(name)) return null;
  return path.join(videosDirFor(campaign.contentPath), name);
}

function pruneVideos(contentPath: string, doc: CampaignDoc, keep: string[]) {
  const dir = videosDirFor(contentPath);
  const used = new Set<string>([...docVideos(doc), ...keep]);
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return;
  }
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  for (const file of files) {
    // Half-written uploads (.part) age out the same way.
    const known = VIDEO_NAME_PATTERN.test(file) || /^[a-f0-9]{32}\.part$/.test(file);
    if (used.has(file) || !known) continue;
    const full = path.join(dir, file);
    if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
  }
}

/** Sniff the audio format from the first bytes; the browser's claimed type isn't trusted. */
export function detectSoundType(head: Uint8Array): "mp3" | "m4a" | "ogg" | "wav" | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...head.subarray(start, end));
  if (ascii(0, 3) === "ID3" || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0)) return "mp3";
  if (ascii(0, 4) === "OggS") return "ogg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE") return "wav";
  if (ascii(4, 8) === "ftyp") return "m4a";
  return null;
}

export function saveCampaignSound(
  campaign: OwnedCampaign,
  body: ReadableStream<Uint8Array>,
  max = SOUND_MAX_BYTES,
): Promise<VideoSaveResult> {
  return streamUpload(soundsDirFor(campaign.contentPath), body, Math.min(max, SOUND_MAX_BYTES), detectSoundType);
}

/** Null for any name that isn't one we generated. */
export function campaignSoundPath(campaign: OwnedCampaign, name: string) {
  if (!SOUND_NAME_PATTERN.test(name)) return null;
  return path.join(soundsDirFor(campaign.contentPath), name);
}

function pruneSounds(contentPath: string, doc: CampaignDoc, keep: string[]) {
  const dir = soundsDirFor(contentPath);
  const used = new Set<string>([...docSounds(doc), ...keep]);
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return;
  }
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  for (const file of files) {
    const known = SOUND_NAME_PATTERN.test(file) || /^[a-f0-9]{32}\.part$/.test(file);
    if (used.has(file) || !known) continue;
    const full = path.join(dir, file);
    if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
  }
}
