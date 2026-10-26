"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { CAMPAIGN_TITLE_MAX, createCampaign, normalizeCampaignTitle } from "@/lib/campaigns";

export type NewCampaignState = { error: string | null };

export async function createCampaignAction(
  _prev: NewCampaignState,
  formData: FormData,
): Promise<NewCampaignState> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const title = normalizeCampaignTitle(String(formData.get("title") ?? ""));
  if (!title) return { error: `Give it a name, up to ${CAMPAIGN_TITLE_MAX} characters` };

  const result = createCampaign(user.id, title);
  if ("error" in result) return { error: `You already have a campaign called "${title}"` };
  redirect(`/campaigns/${result.id}`);
}
