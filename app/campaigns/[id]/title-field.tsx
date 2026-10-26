"use client";

import { useState, useTransition } from "react";
import { CAMPAIGN_TITLE_MAX } from "@/lib/campaign-doc";
import { renameCampaignAction } from "./actions";
import styles from "./editor.module.css";

/** A rejected name stays in the field with the reason. */
export function TitleField({
  campaignId,
  title,
  onRenamed,
}: {
  campaignId: string;
  title: string;
  onRenamed: (title: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit() {
    const next = draft.replace(/\s+/g, " ").trim();
    if (next === title) {
      setDraft(title);
      setError(null);
      return;
    }
    startTransition(async () => {
      const result = await renameCampaignAction(campaignId, next);
      if (result.ok) {
        setDraft(result.title);
        setError(null);
        onRenamed(result.title);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className={styles.titleField}>
      <input
        className={styles.titleInput}
        value={draft}
        maxLength={CAMPAIGN_TITLE_MAX}
        aria-label="Campaign name"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "campaign-title-error" : undefined}
        data-invalid={error ? "" : undefined}
        readOnly={pending}
        spellCheck={false}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setDraft(title);
            setError(null);
            // Blurring after the revert makes the blur commit a no-op.
            requestAnimationFrame(() => (event.target as HTMLInputElement).blur());
          }
        }}
      />
      {error ? (
        <p id="campaign-title-error" className={styles.titleError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
