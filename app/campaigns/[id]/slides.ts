import { openerSelection, type CampaignChapter, type CampaignDoc, type CampaignPage } from "@/lib/campaign-doc";

/** One slide of a deck: a chapter's opener, or a page. Shared by Present and the player's screen. */
export type Slide =
  | { kind: "opener"; id: string; chapter: CampaignChapter; ci: number }
  | { kind: "page"; id: string; chapter: CampaignChapter; ci: number; page: CampaignPage; pi: number };

export function slidesOf(doc: CampaignDoc): Slide[] {
  return doc.chapters.flatMap((chapter, ci): Slide[] => [
    ...(chapter.opener ? [{ kind: "opener" as const, id: openerSelection(chapter.id), chapter, ci }] : []),
    ...chapter.pages.map((page, pi) => ({ kind: "page" as const, id: page.id, chapter, ci, page, pi })),
  ]);
}
