"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import ui from "../../ui.module.css";
import styles from "./editor.module.css";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  tone?: "danger" | "neutral";
};

/** Cancel takes focus so a stray Enter never destroys anything; a pending confirm can't be closed. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pending = false,
  error,
  onConfirm,
  onClose,
  tone = "danger",
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div className={styles.dialogBody}>
        <h2 id={titleId} className={styles.dialogTitle}>
          {title}
        </h2>
        <div className={styles.dialogText}>{children}</div>
        {error ? (
          <p className={styles.dialogError} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.dialogActions}>
          <button
            ref={cancelRef}
            type="button"
            className={ui.secondary}
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={tone === "danger" ? `${ui.primary} ${styles.danger}` : ui.primary}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
