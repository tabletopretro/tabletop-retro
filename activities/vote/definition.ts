import { VoteIcon } from "@/app/icons";
import { defineActivity, type ActivityConfig } from "../types";
import { VoteEditor } from "./editor";
import { VoteStage } from "./stage";
import { VotePlay } from "./play";
import { VoteControls } from "./controls";

export type VoteConfig = ActivityConfig & {
  type: "vote";
  prompt: string;
  options: string[];
  anonymous: boolean;
};

/** Each option's count, and who picked it (null on anonymous pages). */
export type VoteTally = { counts: number[]; voters: Record<number, string[]> | null };

/** `tally` is sent once allowed (shown, or the Table Lead); `mine` is the choice a player submitted. */
export type VoteData = {
  tally: VoteTally | null;
  mine: number | null;
};

export const VOTE_PROMPT_MAX = 300;
export const VOTE_OPTION_MAX = 80;
export const VOTE_OPTIONS_MIN = 2;
export const VOTE_OPTIONS_MAX = 8;

const str = (value: unknown, max: number) => (typeof value === "string" && value.length <= max ? value : null);

export const vote = defineActivity<VoteConfig, VoteData>({
  id: "vote",
  name: "Vote",
  blurb: "You ask and give the options; each player picks one.",
  Icon: VoteIcon,
  timed: true,
  reveal: { done: "voted", show: "Show results", hide: "Hide results", none: "collect votes" },
  make: () => ({ prompt: "", options: ["", ""], anonymous: false }),
  parse: (raw) => {
    const prompt = str(raw.prompt ?? "", VOTE_PROMPT_MAX);
    if (prompt === null) return null;
    if (raw.anonymous !== undefined && typeof raw.anonymous !== "boolean") return null;
    if (!Array.isArray(raw.options) || raw.options.length > VOTE_OPTIONS_MAX) return null;
    const options = raw.options.map((o) => str(o, VOTE_OPTION_MAX));
    if (options.some((o) => o === null)) return null;
    return { prompt, options: options as string[], anonymous: raw.anonymous === true };
  },
  hasContent: (config) => config.prompt.trim() !== "" || config.options.some((o) => o.trim() !== ""),
  summary: (config) => config.prompt.trim().split("\n")[0].trim() || null,
  empty: (config) => (config.prompt || config.options.some((o) => o.trim()) ? null : "No question written yet."),
  Editor: VoteEditor,
  Stage: VoteStage,
  Play: VotePlay,
  Controls: VoteControls,
});
