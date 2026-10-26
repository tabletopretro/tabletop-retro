"use client";

import type { ControlsProps } from "../types";
import { AnswerCards } from "./results";
import type { QaConfig, QaData } from "./definition";

export function QaControls({ feed, names }: ControlsProps<QaConfig, QaData>) {
  if (!feed?.data.answers) return null;
  return <AnswerCards answers={feed.data.answers} nameOf={names.nameOf} compact />;
}
