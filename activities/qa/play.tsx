"use client";

import { useState } from "react";
import { CheckIcon, CloseIcon, PencilIcon, PlusIcon, TrashIcon } from "@/app/icons";
import { Tooltip } from "@/app/tooltip";
import type { PlayProps } from "../types";
import { Asked, AskedError } from "../kit/asked";
import { useOpen, useRun } from "../kit/timer";
import { QA_ANSWER_MAX, type QaConfig, type QaData } from "./definition";
import styles from "../kit/asked.module.css";

export function QaPlay({ config, feed, names, act }: PlayProps<QaConfig, QaData>) {
  const open = useOpen(feed);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const { run, pending, error } = useRun();
  const mine = feed?.data.mine ?? [];

  const add = () => {
    const text = draft.trim();
    if (text && !pending) run(() => act("add", { answer: text }), () => setDraft(""));
  };

  const mineIds = new Set(mine.map((a) => a.id));
  const cards = feed?.data.answers
    ? feed.data.answers.map((r) => ({ id: r.id, answer: r.answer, by: r.seatId, mine: mineIds.has(r.id) }))
    : mine.map((a) => ({ id: a.id, answer: a.answer, by: null, mine: true }));

  return (
    <Asked prompt={config.prompt} feed={feed}>
      {open ? (
        <form
          className={styles.compose}
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <textarea
            className={styles.input}
            value={draft}
            rows={1}
            maxLength={QA_ANSWER_MAX}
            placeholder="Your answer"
            aria-label="Your answer"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                add();
              }
            }}
          />
          <button type="submit" className={styles.primary} disabled={pending || !draft.trim()}>
            <PlusIcon size={16} />
            Add
          </button>
        </form>
      ) : null}
      <AskedError error={error} />
      {cards.length > 0 ? (
        <ul className={styles.cards}>
          {cards.map((a) =>
            editing?.id === a.id ? (
              <li key={a.id} className={styles.card} data-mine="" data-editing="">
                <textarea
                  className={styles.cardInput}
                  value={editing.text}
                  maxLength={QA_ANSWER_MAX}
                  aria-label="Edit your answer"
                  autoFocus
                  onChange={(event) => setEditing({ id: a.id, text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEditing(null);
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      run(() => act("edit", { id: a.id, answer: editing.text }), () => setEditing(null));
                    }
                  }}
                />
                <span className={styles.cardTools}>
                  <Tooltip content="Cancel" side="top">
                    <button type="button" className={styles.iconButton} aria-label="Cancel" onClick={() => setEditing(null)}>
                      <CloseIcon size={16} />
                    </button>
                  </Tooltip>
                  <Tooltip content="Save" side="top">
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label="Save"
                      disabled={pending || !editing.text.trim()}
                      onClick={() => run(() => act("edit", { id: a.id, answer: editing.text }), () => setEditing(null))}
                    >
                      <CheckIcon size={16} />
                    </button>
                  </Tooltip>
                </span>
              </li>
            ) : (
              <li key={a.id} className={styles.card} data-mine={a.mine ? "" : undefined}>
                <span className={styles.cardText}>{a.answer}</span>
                {a.by ? <span className={styles.cardBy}>{names.nameOf(a.by)}</span> : null}
                {open && a.mine ? (
                  <span className={styles.cardTools}>
                    <Tooltip content="Edit" side="top">
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="Edit answer"
                        onClick={() => setEditing({ id: a.id, text: a.answer })}
                      >
                        <PencilIcon size={16} />
                      </button>
                    </Tooltip>
                    <Tooltip content="Remove" side="top">
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="Remove answer"
                        disabled={pending}
                        onClick={() => run(() => act("remove", { id: a.id }))}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </Tooltip>
                  </span>
                ) : null}
              </li>
            ),
          )}
        </ul>
      ) : null}
    </Asked>
  );
}
