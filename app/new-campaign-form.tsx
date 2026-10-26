"use client";

import { useActionState, useState } from "react";
import { createCampaignAction, type NewCampaignState } from "./campaign-actions";
import { ArrowIcon } from "./icons";
import ui from "./ui.module.css";

const INITIAL: NewCampaignState = { error: null };

export function NewCampaignForm({ autoFocus }: { autoFocus?: boolean }) {
  const [state, formAction, pending] = useActionState(createCampaignAction, INITIAL);
  const [title, setTitle] = useState("");

  return (
    <form action={formAction} className={ui.form} noValidate>
      <div className={ui.field} data-invalid={state.error ? "" : undefined}>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Name a new campaign"
          aria-label="Campaign name"
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={80}
          className={ui.input}
          aria-invalid={state.error ? true : undefined}
          aria-describedby="campaign-title-error"
        />
        <button
          type="submit"
          className={ui.go}
          disabled={pending || !title.trim()}
          aria-label="Create campaign"
        >
          <ArrowIcon size={20} />
        </button>
      </div>
      <p id="campaign-title-error" className={ui.error} aria-live="polite">
        {state.error}
      </p>
    </form>
  );
}
