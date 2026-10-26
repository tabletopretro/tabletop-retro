"use client";

import { useActionState, useState } from "react";
import { TABLE_CODE_EXAMPLE } from "@/lib/table-code";
import { joinTable, type JoinTableState } from "./actions";
import styles from "./join-form.module.css";

const INITIAL: JoinTableState = { error: null };

export function JoinForm({ size = "large", autoFocus = false }: { size?: "large" | "compact"; autoFocus?: boolean }) {
  const [state, formAction, pending] = useActionState(joinTable, INITIAL);
  // Controlled: React resets uncontrolled fields after an action, losing a rejected code.
  const [code, setCode] = useState("");

  return (
    <form action={formAction} noValidate>
      <div className={styles.codeField} data-size={size}>
        <input
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={TABLE_CODE_EXAMPLE}
          aria-label="Table code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={11}
          autoFocus={autoFocus}
          aria-invalid={state.error ? true : undefined}
          aria-describedby="table-code-error"
        />
        <button type="submit" disabled={pending} aria-label="Join table">
          Join
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          </svg>
        </button>
        <span className={styles.caret} aria-hidden />
      </div>
      <p id="table-code-error" className={styles.hint} aria-live="polite">
        {state.error}
      </p>
    </form>
  );
}
