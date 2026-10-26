"use client";

import { useActionState, useState } from "react";
import {
  createLocalUserAndSignIn,
  type CreateLocalUserState,
} from "@/app/auth-actions";
import { ArrowIcon } from "@/app/icons";
import ui from "@/app/ui.module.css";

const INITIAL: CreateLocalUserState = { error: null };

export function NewLocalUserForm() {
  const [state, formAction, pending] = useActionState(
    createLocalUserAndSignIn,
    INITIAL,
  );
  const [name, setName] = useState("");

  return (
    <form action={formAction} className={ui.form} noValidate>
      <div className={ui.field} data-invalid={state.error ? "" : undefined}>
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New name"
          aria-label="New local user name"
          autoComplete="off"
          maxLength={40}
          className={ui.input}
          aria-invalid={state.error ? true : undefined}
          aria-describedby="new-user-error"
        />
        <button
          type="submit"
          className={ui.go}
          disabled={pending || !name.trim()}
          aria-label="Create and sign in"
        >
          <ArrowIcon size={20} />
        </button>
      </div>
      <p id="new-user-error" className={ui.error} aria-live="polite">
        {state.error}
      </p>
    </form>
  );
}
