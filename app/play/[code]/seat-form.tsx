"use client";

import { useActionState } from "react";
import { GUEST_NAME_MAX_CLIENT } from "../limits";
import { takeSeatAction, type SeatState } from "./actions";
import styles from "../play.module.css";

const INITIAL: SeatState = { error: null };

export function SeatForm({ code, signedInAs }: { code: string; signedInAs: string | null }) {
  const [state, formAction, pending] = useActionState(takeSeatAction.bind(null, code), INITIAL);
  return (
    <form action={formAction} className={styles.seatForm} noValidate>
      {signedInAs ? null : (
        <input
          name="name"
          className={styles.nameInput}
          placeholder="Your name"
          aria-label="Your name"
          autoComplete="nickname"
          maxLength={GUEST_NAME_MAX_CLIENT}
          autoFocus
          aria-invalid={state.error ? true : undefined}
        />
      )}
      <button type="submit" className={styles.sit} disabled={pending}>
        {signedInAs ? `Take a seat as ${signedInAs}` : "Take a seat"}
      </button>
      <p className={styles.error} aria-live="polite">
        {state.error}
      </p>
    </form>
  );
}
