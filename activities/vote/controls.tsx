"use client";

import type { ControlsProps } from "../types";
import { VoteResults } from "./results";
import type { VoteConfig, VoteData } from "./definition";

export function VoteControls({ config, feed, names }: ControlsProps<VoteConfig, VoteData>) {
  if (!feed?.data.tally) return null;
  return <VoteResults options={config.options} tally={feed.data.tally} nameOf={names.nameOf} compact />;
}
