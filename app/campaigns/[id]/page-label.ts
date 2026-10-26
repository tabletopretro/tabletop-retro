import type { CampaignPage } from "@/lib/campaign-doc";
import { UNNAMED_CHARACTER, UNTITLED_CHARACTER, type Character } from "@/lib/character-doc";
import { activityName, activitySummary } from "@/activities";

export type PageLabel = {
  text: string;
  /** Taken from the content, not typed as a name. */
  derived: boolean;
  /** Nothing on the page to go on yet. */
  empty: boolean;
};

export const EMPTY_PAGE_LABEL = "Untitled page";

const MAX = 80;
const firstLine = (text: string) => text.trim().split("\n")[0].trim();
const clip = (text: string) => (text.length > MAX ? `${text.slice(0, MAX - 1).trimEnd()}…` : text);

export function derivedLabel(page: CampaignPage, cast: readonly Character[]): string | null {
  if (page.kind === "story") {
    const text = page.heading.trim() || firstLine(page.text) || page.imageAlt.trim();
    return text ? clip(text) : page.image ? "Image" : page.video ? "Video" : null;
  }
  if (page.kind === "speech") {
    const speaker = page.speakerId ? (cast.find((c) => c.id === page.speakerId) ?? null) : null;
    const name = page.speakerId ? (speaker ? speaker.name.trim() || UNTITLED_CHARACTER : UNNAMED_CHARACTER) : null;
    const line = firstLine(page.line);
    if (name && line) return clip(`${name}: “${line}”`);
    return name ?? (line ? clip(`“${line}”`) : null);
  }
  if (page.kind === "activity" && page.activity) {
    const name = activityName(page.activity);
    const summary = activitySummary(page.activity);
    return clip(summary ? `${name}: ${summary}` : name);
  }
  return null;
}

export function pageLabel(page: CampaignPage, cast: readonly Character[]): PageLabel {
  const name = page.title.trim();
  if (name) return { text: name, derived: false, empty: false };
  const derived = derivedLabel(page, cast);
  return derived ? { text: derived, derived: true, empty: false } : { text: EMPTY_PAGE_LABEL, derived: true, empty: true };
}
