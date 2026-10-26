import { QaIcon } from "@/app/icons";
import { defineActivity, type ActivityConfig } from "../types";
import { QaEditor } from "./editor";
import { QaStage } from "./stage";
import { QaPlay } from "./play";
import { QaControls } from "./controls";

export type QaConfig = ActivityConfig & {
  type: "qa";
  prompt: string;
  anonymous: boolean;
};

/** One answer as viewers get it; `seatId` is null on anonymous pages. */
export type QaAnswer = { id: string; seatId: string | null; answer: string };

/** `answers` is everyone's once allowed (shown, or the Table Lead); `mine` is a player's own. */
export type QaData = {
  answers: QaAnswer[] | null;
  mine: { id: string; answer: string }[];
};

export const QA_PROMPT_MAX = 300;
/** Kept in step with the server's check in server.ts. */
export const QA_ANSWER_MAX = 300;

const str = (value: unknown, max: number) => (typeof value === "string" && value.length <= max ? value : null);

export const qa = defineActivity<QaConfig, QaData>({
  id: "qa",
  name: "Q&A",
  blurb: "You ask; each player types an answer on their device.",
  Icon: QaIcon,
  timed: true,
  reveal: { done: "answered", show: "Show answers", hide: "Hide answers", none: "collect answers" },
  make: () => ({ prompt: "", anonymous: false }),
  parse: (raw) => {
    const prompt = str(raw.prompt ?? "", QA_PROMPT_MAX);
    if (prompt === null) return null;
    if (raw.anonymous !== undefined && typeof raw.anonymous !== "boolean") return null;
    return { prompt, anonymous: raw.anonymous === true };
  },
  hasContent: (config) => config.prompt.trim() !== "",
  summary: (config) => config.prompt.trim().split("\n")[0].trim() || null,
  empty: (config) => (config.prompt ? null : "No question written yet."),
  Editor: QaEditor,
  Stage: QaStage,
  Play: QaPlay,
  Controls: QaControls,
});
