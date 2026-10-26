"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ChatIcon, CrownIcon, SendIcon } from "../icons";
import styles from "./chat.module.css";

/** Mirrors ChatMessage in lib/table-chat.ts (server-only). */
export type ChatMessage = {
  id: string;
  seatId: string | null;
  fromLead: boolean;
  name: string;
  body: string;
  at: number;
};

/** Kept in step with CHAT_MAX in lib/table-chat.ts. */
export const CHAT_MAX_CLIENT = 500;

type ChatResult = { ok: true } | { ok: false; error: string };

/** `null` means no feed. History arrives again on reconnect. */
export function useTableChat(url: string | null): ChatMessage[] {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    if (!url) return;
    const feed = new EventSource(url);
    feed.onmessage = (event) => {
      let data: { history?: ChatMessage[]; message?: ChatMessage };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.history) setMessages(data.history);
      const message = data.message;
      if (message) setMessages((all) => (all.some((m) => m.id === message.id) ? all : [...all, message]));
    };
    return () => feed.close();
  }, [url]);
  return url ? messages : [];
}

const GROUP_MS = 5 * 60_000;
const TIME_GAP_MS = 15 * 60_000;

const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayAndClock = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

function timeLabel(at: number) {
  const date = new Date(at);
  return date.toDateString() === new Date().toDateString() ? clock.format(date) : dayAndClock.format(date);
}

export function LeadAvatar({ size = 28 }: { size?: number }) {
  return (
    <span className={styles.leadAvatar} style={{ width: size, height: size }} aria-hidden>
      <CrownIcon size={Math.round(size * 0.6)} />
    </span>
  );
}

export function TableChat({
  messages,
  isMine,
  nameOf,
  avatarOf,
  send,
  autoFocus = false,
}: {
  messages: ChatMessage[];
  isMine: (message: ChatMessage) => boolean;
  nameOf: (message: ChatMessage) => string;
  avatarOf: (message: ChatMessage) => ReactNode;
  send: (body: string) => Promise<ChatResult>;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pinned = useRef(true);
  // Messages already there (or in the history just after) don't animate in.
  const [baseline, setBaseline] = useState<Set<string> | null>(() =>
    messages.length > 0 ? new Set(messages.map((m) => m.id)) : null,
  );
  if (baseline === null && messages.length > 0) setBaseline(new Set(messages.map((m) => m.id)));
  const settled = baseline !== null;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && pinned.current) list.scrollTo({ top: list.scrollHeight, behavior: settled ? "smooth" : "auto" });
  }, [messages.length, settled]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;
    startTransition(async () => {
      setError(null);
      try {
        const result = await send(body);
        if (result.ok) {
          setDraft("");
          pinned.current = true;
          inputRef.current?.focus();
        } else setError(result.error);
      } catch {
        setError("Couldn't reach the table. Try again.");
      }
    });
  }

  const timeBefore = (a: ChatMessage | undefined, b: ChatMessage) => a === undefined || b.at - a.at >= TIME_GAP_MS;
  const sameRun = (a: ChatMessage | undefined, b: ChatMessage | undefined) =>
    a !== undefined &&
    b !== undefined &&
    !timeBefore(a, b) &&
    a.fromLead === b.fromLead &&
    a.seatId === b.seatId &&
    b.at - a.at < GROUP_MS;

  return (
    <div className={styles.chat}>
      <ol
        ref={listRef}
        className={styles.messages}
        aria-label="Messages"
        aria-live="polite"
        onScroll={(event) => {
          const list = event.currentTarget;
          pinned.current = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
        }}
      >
        {messages.length === 0 ? (
          <li className={styles.empty} aria-label="No messages yet">
            <ChatIcon size={40} />
          </li>
        ) : null}
        {messages.map((message, index) => {
          const first = !sameRun(messages[index - 1], message);
          const last = !sameRun(message, messages[index + 1]);
          const mine = isMine(message);
          return (
            <Fragment key={message.id}>
            {timeBefore(messages[index - 1], message) ? (
              <li className={styles.time}>
                <time dateTime={new Date(message.at).toISOString()}>{timeLabel(message.at)}</time>
              </li>
            ) : null}
            <li
              className={styles.message}
              data-mine={mine ? "" : undefined}
              data-lead={message.fromLead ? "" : undefined}
              data-first={first ? "" : undefined}
              data-last={last ? "" : undefined}
              data-new={baseline && !baseline.has(message.id) ? "" : undefined}
            >
              {mine ? null : <span className={styles.avatar}>{last ? avatarOf(message) : null}</span>}
              <span className={styles.stack}>
                {first && !mine ? (
                  <span className={styles.sender} data-lead={message.fromLead ? "" : undefined}>
                    {nameOf(message)}
                  </span>
                ) : null}
                <span className={styles.bubble}>{message.body}</span>
              </span>
            </li>
            </Fragment>
          );
        })}
      </ol>
      <form className={styles.compose} onSubmit={submit}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={draft}
          rows={1}
          maxLength={CHAT_MAX_CLIENT}
          placeholder="Message the table"
          aria-label="Message the table"
          autoFocus={autoFocus}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button type="submit" className={styles.send} aria-label="Send" disabled={pending || !draft.trim()}>
          <SendIcon size={16} />
        </button>
      </form>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
