"use client";

import type { StageProps } from "../types";
import { Asked } from "../kit/asked";
import { VoteResults } from "./results";
import type { VoteConfig, VoteData } from "./definition";
import styles from "../kit/asked.module.css";

export function VoteStage({ config, feed, names }: StageProps<VoteConfig, VoteData>) {
  const tally = feed?.shown ? feed.data.tally : null;
  return (
    <Asked prompt={config.prompt} feed={feed}>
      {tally ? (
        <VoteResults options={config.options} tally={tally} nameOf={names.nameOf} />
      ) : (
        <ol className={styles.options}>
          {config.options.map((o, i) =>
            o.trim() ? (
              <li key={i} className={styles.option}>
                {o}
              </li>
            ) : null,
          )}
        </ol>
      )}
    </Asked>
  );
}
