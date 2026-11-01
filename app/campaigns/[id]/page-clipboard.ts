import {
  docImages,
  docSounds,
  docVideos,
  parseCampaignDoc,
  type CampaignDoc,
  type CampaignPage,
} from "@/lib/campaign-doc";

/**
 * Pages on the clipboard: ⌘C / ⌘X on a page in the editor, ⌘V to paste.
 * The pages travel as JSON under our own type, so they paste into any
 * campaign in the same browser, with plain text alongside for anywhere
 * else. Whatever comes back is hostile until it's been through the parser.
 */
export const PAGE_CLIPBOARD_TYPE = "application/x-tabletop-retro-pages";

export type CopiedPages = { campaignId: string; pages: CampaignPage[] };

/**
 * The last copy from this tab, for browsers that drop custom clipboard
 * types. Only used while the clipboard's text is still what we wrote.
 */
let lastCopy: { text: string; json: string } | null = null;

const holder = (pages: unknown): unknown => ({
  version: 1,
  title: "",
  cast: [],
  chapters: [{ id: "clipboard0", title: "", opener: null, pages }],
});

export function writePages(data: DataTransfer, copied: CopiedPages, text: string) {
  const json = JSON.stringify({ campaignId: copied.campaignId, pages: copied.pages });
  data.setData(PAGE_CLIPBOARD_TYPE, json);
  data.setData("text/plain", text);
  lastCopy = { text, json };
}

export function readPages(data: DataTransfer): CopiedPages | null {
  let json = data.getData(PAGE_CLIPBOARD_TYPE);
  if (!json && lastCopy && data.getData("text/plain") === lastCopy.text) json = lastCopy.json;
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const { campaignId, pages } = raw as Record<string, unknown>;
  if (typeof campaignId !== "string" || !Array.isArray(pages) || pages.length === 0) return null;
  const doc = parseCampaignDoc(holder(pages), "");
  const parsed = doc?.chapters[0]?.pages ?? [];
  return parsed.length > 0 ? { campaignId, pages: parsed } : null;
}

/** Every image, video and sound the pages use. */
export function pagesMedia(pages: CampaignPage[]): string[] {
  const doc = holder(pages) as CampaignDoc;
  return [...docImages(doc), ...docVideos(doc), ...docSounds(doc)];
}
