"use client";

import { useState } from "react";
import { CheckIcon } from "@/app/icons";
import type { PlayProps } from "../types";
import { Asked, AskedError } from "../kit/asked";
import { useOpen, useRun } from "../kit/timer";
import { VoteResults } from "./results";
import type { VoteConfig, VoteData } from "./definition";
import styles from "../kit/asked.module.css";

export function VotePlay({ config, feed, names, act }: PlayProps<VoteConfig, VoteData>) {
  const open = useOpen(feed);
  const submitted = feed?.data.mine ?? null;
  const [picked, setPicked] = useState<number | null>(null);
  const { run, pending, error } = useRun();
  const chosen = submitted ?? picked;
  const tally = feed?.data.tally ?? null;

  if (tally && (submitted !== null || !open)) {
    return (
      <Asked prompt={config.prompt} feed={feed}>
        <VoteResults options={config.options} tally={tally} nameOf={names.nameOf} mine={submitted} />
      </Asked>
    );
  }

  return (
    <Asked prompt={config.prompt} feed={feed}>
      <div className={styles.options} role="radiogroup" aria-label="Options">
        {config.options.map((option, index) =>
          option.trim() ? (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={chosen === index}
              className={styles.pick}
              disabled={!open || submitted !== null}
              onClick={() => setPicked(index)}
            >
              <span className={styles.pickMark} aria-hidden>
                {chosen === index ? <CheckIcon size={14} /> : null}
              </span>
              {option}
            </button>
          ) : null,
        )}
      </div>
      {submitted !== null ? (
        <p className={styles.submitted}>
          <CheckIcon size={16} />
          Submitted
        </p>
      ) : open ? (
        <button
          type="button"
          className={styles.primary}
          disabled={pending || picked === null}
          onClick={() => picked !== null && run(() => act("submit", { choice: picked }))}
        >
          Submit
        </button>
      ) : null}
      <AskedError error={error} />
      {tally ? <VoteResults options={config.options} tally={tally} nameOf={names.nameOf} /> : null}
    </Asked>
  );
}
