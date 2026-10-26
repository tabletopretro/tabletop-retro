"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { castMembers } from "@/lib/character-doc";
import { campaignForOwner, readCampaignDoc } from "@/lib/campaigns";
import { listCharacters } from "@/lib/characters";
import type { ActivityResult } from "@/activities/types";
import { restartTimer, runLeadAction, setShown } from "@/lib/activity-runtime";
import { postChat, type PostChatResult } from "@/lib/table-chat";
import {
  campaignCode,
  closeTable,
  listSeats,
  liveTable,
  newCampaignCode,
  openTable,
  setCurrentSlide,
  removeSeat,
  setPlayback,
  setSeatCharacter,
  snapshotOf,
  type SeatInfo,
} from "@/lib/tables";

/* Every export is a public endpoint: each re-checks the session and campaign ownership. */

async function owned(campaignId: unknown) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const campaign = typeof campaignId === "string" ? campaignForOwner(campaignId, user.id) : null;
  return campaign ? { user, campaign } : null;
}

export type TableInfo = {
  code: string;
  /** `slide` is where the players are: the last slide the TL presented. */
  table: { id: string; state: "open"; slide: string | null } | null;
  seats: SeatInfo[];
};

function info(campaignId: string): TableInfo {
  const table = liveTable(campaignId);
  return {
    code: campaignCode(campaignId),
    table: table && table.state !== "closed" ? { id: table.id, state: table.state, slide: table.currentSlide } : null,
    seats: table ? listSeats(table.id) : [],
  };
}

export type NewCodeState = { ok: true; code: string } | { ok: false; error: string };

export async function newCodeAction(campaignId: string): Promise<NewCodeState> {
  const ok = await owned(campaignId);
  if (!ok) return { ok: false, error: "This campaign no longer exists" };
  const result = newCampaignCode(ok.campaign.id);
  if ("error" in result) return { ok: false, error: "Close the table before changing its code" };
  return { ok: true, code: result.code };
}

const SLIDE_PATTERN = /^(opener:)?[a-z0-9]{10}$/;

/** Snapshots the campaign as saved on disk (the editor saves first), with TL-only notes left out. */
export async function openTableAction(campaignId: string, slide: unknown): Promise<TableInfo | null> {
  const ok = await owned(campaignId);
  if (!ok) return null;
  const doc = readCampaignDoc(ok.campaign);
  const cast = castMembers(doc.cast, listCharacters(ok.user.id));
  const start = typeof slide === "string" && SLIDE_PATTERN.test(slide) ? slide : null;
  openTable(ok.campaign.id, ok.user.id, snapshotOf(doc, cast), start);
  return info(ok.campaign.id);
}

export async function closeTableAction(campaignId: string): Promise<TableInfo | null> {
  const ok = await owned(campaignId);
  if (!ok) return null;
  const table = liveTable(ok.campaign.id);
  if (table) closeTable(table.id);
  return info(ok.campaign.id);
}

export async function setSlideAction(campaignId: string, slide: unknown): Promise<void> {
  const ok = await owned(campaignId);
  if (!ok || typeof slide !== "string" || !SLIDE_PATTERN.test(slide)) return;
  const table = liveTable(ok.campaign.id);
  if (table) setCurrentSlide(table.id, slide);
}

export async function setPlaybackAction(campaignId: string, slide: unknown, playing: unknown, position: unknown): Promise<void> {
  const ok = await owned(campaignId);
  if (!ok || typeof slide !== "string" || !SLIDE_PATTERN.test(slide)) return;
  if (typeof playing !== "boolean" || typeof position !== "number" || !Number.isFinite(position) || position < 0) return;
  const table = liveTable(ok.campaign.id);
  if (table) setPlayback(table.id, { slide, playing, position });
}

const CHARACTER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function releaseSeatAction(campaignId: string, seatId: unknown): Promise<void> {
  const ok = await owned(campaignId);
  if (!ok || typeof seatId !== "string" || !CHARACTER_ID.test(seatId)) return;
  const table = liveTable(ok.campaign.id);
  if (table) setSeatCharacter(table.id, seatId, null);
}

export async function sendTableChatAction(campaignId: string, body: unknown): Promise<PostChatResult> {
  const ok = await owned(campaignId);
  if (!ok) return { ok: false, error: "This campaign no longer exists" };
  const table = liveTable(ok.campaign.id);
  if (!table) return { ok: false, error: "The table is closed" };
  return postChat(table.id, { lead: true, name: ok.user.name }, body);
}

export async function removeSeatAction(campaignId: string, seatId: unknown): Promise<void> {
  const ok = await owned(campaignId);
  if (!ok || typeof seatId !== "string" || !CHARACTER_ID.test(seatId)) return;
  const table = liveTable(ok.campaign.id);
  if (table) removeSeat(table.id, seatId);
}

export async function showAnswersAction(campaignId: string, slide: unknown, shown: unknown): Promise<void> {
  const ok = await owned(campaignId);
  if (!ok || typeof slide !== "string" || !SLIDE_PATTERN.test(slide) || typeof shown !== "boolean") return;
  const table = liveTable(ok.campaign.id);
  if (table) setShown(table.id, slide, shown);
}

export async function restartTimerAction(campaignId: string, slide: unknown): Promise<void> {
  const ok = await owned(campaignId);
  if (!ok || typeof slide !== "string" || !SLIDE_PATTERN.test(slide)) return;
  const table = liveTable(ok.campaign.id);
  if (table) restartTimer(table.id, slide);
}

/** The handler treats the payload as hostile; this only checks the table is the TL's own. */
export async function leadActivityAction(campaignId: string, slide: unknown, action: unknown, payload: unknown): Promise<ActivityResult> {
  const ok = await owned(campaignId);
  if (!ok) return { ok: false, error: "This campaign no longer exists" };
  const table = liveTable(ok.campaign.id);
  if (!table) return { ok: false, error: "The table is closed" };
  return runLeadAction(table.id, slide, action, payload);
}
