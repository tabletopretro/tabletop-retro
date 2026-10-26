"use client";

import type { StageProps } from "../types";
import { Asked } from "../kit/asked";
import { AnswerCards } from "./results";
import type { QaConfig, QaData } from "./definition";

export function QaStage({ config, feed, names }: StageProps<QaConfig, QaData>) {
  const answers = feed?.shown ? feed.data.answers : null;
  return (
    <Asked prompt={config.prompt} feed={feed}>
      {answers ? <AnswerCards answers={answers} nameOf={names.nameOf} /> : null}
    </Asked>
  );
}
