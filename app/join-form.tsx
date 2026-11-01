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
          aria-label="Table code"
          aria-placeholder={TABLE_CODE_EXAMPLE}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          autoFocus={autoFocus}
          aria-invalid={state.error ? true : undefined}
          aria-describedby="table-code-error"
        />
        {/* The block is the caret: a mirror of the typed text, in the input's own metrics, puts it after the last letter. */}
        <span className={styles.mirror} aria-hidden>
          {code}
          <span className={styles.caret} />
          {code ? null : <span className={styles.ghost}>{TABLE_CODE_EXAMPLE}</span>}
        </span>
        <button type="submit" disabled={pending} aria-label="Join table">
          Join
        </button>
      </div>
      <p id="table-code-error" className={styles.hint} aria-live="polite">
        {state.error}
      </p>
    </form>
  );
}
