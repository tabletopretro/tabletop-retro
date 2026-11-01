import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { campaignForOwner, readCampaignDoc } from "@/lib/campaigns";
import { listCharacters } from "@/lib/characters";
import { campaignCode, listSeats, liveTable } from "@/lib/tables";
import { CampaignEditor } from "./campaign-editor";
import { FOLDS_COOKIE, parseFolds } from "./outline-folds";
import { OUTLINE_WIDTH_COOKIE, parseOutlineWidth } from "./outline-width";

/** Someone else's campaign 404s, not 403, so ids can't be probed. */
export async function generateMetadata({ params }: PageProps<"/campaigns/[id]">) {
  const user = await requireUser();
  const campaign = campaignForOwner((await params).id, user.id);
  return { title: `${campaign?.title ?? "Campaign"} · Tabletop Retro` };
}

export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  // Untrusted: the editor only uses `at` if it names something in this campaign.
  const query = await searchParams;
  const mode = query.mode === "present" ? "present" : "edit";
  const at = typeof query.at === "string" && query.at.length <= 80 ? query.at : null;
  const campaign = campaignForOwner(id, user.id);
  if (!campaign) notFound();

  // View state the browser remembered, so the outline renders folded and sized rather than snapping after load.
  const jar = await cookies();
  const folds = parseFolds(jar.get(FOLDS_COOKIE)?.value);
  const outlineWidth = parseOutlineWidth(jar.get(OUTLINE_WIDTH_COOKIE)?.value);
  const characters = listCharacters(user.id);
  const doc = readCampaignDoc(campaign);
  // A cast entry for a character that's since been deleted just drops out.
  const known = new Set(characters.map((c) => c.id));
  return (
    <CampaignEditor
      campaignId={campaign.id}
      initialTitle={campaign.title}
      initialDoc={{ ...doc, cast: doc.cast.filter((id) => known.has(id)) }}
      initialCharacters={characters}
      initialTableInfo={tableInfoFor(campaign.id)}
      initialMode={mode}
      initialAt={at}
      initialFolds={folds}
      initialOutlineWidth={outlineWidth}
    />
  );
}

/** Reading the code claims it on first visit. */
function tableInfoFor(campaignId: string) {
  const table = liveTable(campaignId);
  return {
    code: campaignCode(campaignId),
    table:
      table && table.state !== "closed"
        ? { id: table.id, state: table.state, lateSeats: table.lateSeats, slide: table.currentSlide }
        : null,
    seats: table ? listSeats(table.id) : [],
  };
}
