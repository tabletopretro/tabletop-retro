"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckIcon, CopyIcon, TrashIcon } from "../../icons";
import { Tooltip } from "../../tooltip";
import ui from "../../ui.module.css";
import { ConfirmDialog } from "./confirm-dialog";
import styles from "./editor.module.css";
import {
  closeTableAction,
  newCodeAction,
  openTableAction,
  type TableInfo,
} from "./table-actions";

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  return {
    copied,
    copy: (text: string) => {
      void navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1400);
      });
    },
  };
}

export function SettingsDialog({
  open,
  campaignId,
  info,
  onInfo,
  onDelete,
  onClose,
}: {
  open: boolean;
  campaignId: string;
  info: TableInfo;
  onInfo: (info: TableInfo) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { copied, copy } = useCopy();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${styles.settingsDialog}`}
      aria-labelledby="settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.dialogBody}>
        <h2 id="settings-title" className={styles.dialogTitle}>
          Settings
        </h2>

        <section className={styles.settingsSection} aria-labelledby="settings-code">
          <span id="settings-code" className={styles.settingsLabel}>
            Table code
          </span>
          <button
            type="button"
            className={styles.codeBig}
            aria-label={copied ? `${info.code}, copied` : `Copy table code ${info.code}`}
            onClick={() => copy(info.code)}
          >
            <span className={styles.codeText}>{info.code}</span>
            <span className={styles.codeIcon} aria-hidden>
              {copied ? <CheckIcon size={20} /> : <CopyIcon size={20} />}
            </span>
          </button>
          {/* Disabled while the table is open; aria-disabled rather than
              disabled so hovering it can still say why. */}
          <Tooltip content={info.table ? "Close the table to change its code" : "Retires this code for a new one"} side="bottom">
            <button
              type="button"
              className={styles.settingsAction}
              aria-disabled={pending || info.table !== null}
              onClick={() => {
                if (pending || info.table) return;
                startTransition(async () => {
                  setError(null);
                  try {
                    const result = await newCodeAction(campaignId);
                    if (result.ok) onInfo({ ...info, code: result.code });
                    else setError(result.error);
                  } catch {
                    setError("Couldn't reach the server. Try again.");
                  }
                });
              }}
            >
              New code
            </button>
          </Tooltip>
          {error ? (
            <p className={styles.fieldError} role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section className={styles.settingsDangerSection} aria-labelledby="settings-danger">
          <div className={styles.settingsDangerZone}>
            <span id="settings-danger" className={styles.dangerLabel}>
              Danger zone
            </span>
            <button type="button" className={styles.settingsDanger} onClick={onDelete}>
              <TrashIcon size={16} />
              Delete campaign
            </button>
          </div>
        </section>

        <div className={styles.dialogActions}>
          <button type="button" className={ui.secondary} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Presenting lets nobody in; "Open table for players" snapshots the saved campaign and opens the table. */
export function PresentTableBar({
  campaignId,
  info,
  slide,
  beforeOpen,
  onInfo,
}: {
  campaignId: string;
  info: TableInfo;
  slide: string | null;
  /** Saves pending edits so the snapshot has them. */
  beforeOpen: () => Promise<void>;
  onInfo: (info: TableInfo) => void;
}) {
  const { copied, copy } = useCopy();
  const [pending, startTransition] = useTransition();
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (work: () => Promise<void>) =>
    startTransition(async () => {
      setError(null);
      try {
        await work();
      } catch {
        setError("Couldn't reach the server. Try again.");
      }
    });

  const errorLine = error ? (
    <p className={styles.tableError} role="alert">
      {error}
    </p>
  ) : null;

  if (!info.table) {
    return (
      <>
        {errorLine}
        <button
          type="button"
          className={styles.openTable}
          disabled={pending}
          onClick={() =>
            run(async () => {
              await beforeOpen();
              const next = await openTableAction(campaignId, slide);
              if (next) onInfo(next);
            })
          }
        >
          {pending ? "Opening…" : "Open table for players"}
        </button>
      </>
    );
  }

  return (
    <>
      {errorLine}
      <div className={styles.presentWrap}>
        <button type="button" className={styles.tableButton} popoverTarget="table-menu">
          Table
        </button>
        <div id="table-menu" popover="auto" className={`${styles.presentMenu} ${styles.tableMenu}`}>
          <div className={styles.menuCode}>
            <span className={styles.settingsLabel}>Table code</span>
            <button
              type="button"
              className={styles.codeBig}
              aria-label={copied ? `${info.code}, copied` : `Copy table code ${info.code}`}
              onClick={() => copy(info.code)}
            >
              <span className={styles.menuCodeText}>{info.code}</span>
              <span className={styles.codeIcon} aria-hidden>
                {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
              </span>
            </button>
          </div>
          <button
            type="button"
            className={styles.presentOption}
            onClick={(event) => {
              event.currentTarget.closest<HTMLElement>("[popover]")?.hidePopover();
              setConfirmClose(true);
            }}
          >
            Close table
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmClose}
        title="Close the table?"
        confirmLabel="Close table"
        tone="neutral"
        pending={pending}
        onConfirm={() =>
          run(async () => {
            try {
              const next = await closeTableAction(campaignId);
              if (next) onInfo(next);
            } finally {
              setConfirmClose(false);
            }
          })
        }
        onClose={() => setConfirmClose(false)}
      >
        Players leave, and the code stops working until you open the table again.
      </ConfirmDialog>
    </>
  );
}
