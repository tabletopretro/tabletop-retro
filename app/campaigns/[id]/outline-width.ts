/**
 * How wide the TL dragged the outline, remembered in a cookie across all
 * their campaigns so the server renders the editor at that width instead
 * of jumping after load. View state only, and untrusted.
 */
export const OUTLINE_WIDTH_COOKIE = "tr_outline";

export const OUTLINE_WIDTH = { min: 200, max: 560, initial: 280 } as const;

export function clampOutlineWidth(width: number): number {
  if (!Number.isFinite(width)) return OUTLINE_WIDTH.initial;
  return Math.round(Math.min(OUTLINE_WIDTH.max, Math.max(OUTLINE_WIDTH.min, width)));
}

export function parseOutlineWidth(raw: string | undefined): number {
  return raw && /^\d{3}$/.test(raw) ? clampOutlineWidth(Number(raw)) : OUTLINE_WIDTH.initial;
}

export function writeOutlineWidth(width: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${OUTLINE_WIDTH_COOKIE}=${clampOutlineWidth(width)}; Path=/campaigns; Max-Age=31536000; SameSite=Lax${secure}`;
}
