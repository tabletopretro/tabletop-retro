/**
 * Which parts of the outline the TL folded shut (chapters, the cast),
 * remembered per campaign in a cookie scoped to the campaign's path, so
 * the server renders the outline already folded instead of snapping shut
 * after load. View state only: never part of the campaign, and untrusted.
 *
 * Format: "1" or "0" for the cast, then the folded chapter ids, joined by
 * dots ("1.ab12cd34ef.zz98yy76xx").
 */
export const FOLDS_COOKIE = "tr_folds";

export type OutlineFolds = { cast: boolean; chapters: string[] };

const CHAPTER_ID = /^[a-z0-9]{10}$/;
/** Comfortably more chapters than a campaign holds, and well under a cookie's size. */
const MAX_CHAPTERS = 200;

export function parseFolds(raw: string | undefined): OutlineFolds {
  const [cast, ...ids] = (raw ?? "").split(".");
  return { cast: cast === "1", chapters: ids.filter((id) => CHAPTER_ID.test(id)).slice(0, MAX_CHAPTERS) };
}

export function writeFolds(campaignId: string, folds: OutlineFolds) {
  const value = [folds.cast ? "1" : "0", ...folds.chapters.slice(0, MAX_CHAPTERS)].join(".");
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${FOLDS_COOKIE}=${value}; Path=/campaigns/${encodeURIComponent(campaignId)}; Max-Age=31536000; SameSite=Lax${secure}`;
}
