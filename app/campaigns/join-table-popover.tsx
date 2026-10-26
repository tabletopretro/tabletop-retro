"use client";

import { useId } from "react";
import { JoinForm } from "../join-form";
import styles from "./account-bar.module.css";

export function JoinTablePopover() {
  const id = useId();
  return (
    <>
      <button type="button" className={styles.joinButton} popoverTarget={id}>
        Join a table
      </button>
      <div id={id} popover="auto" className={styles.popover}>
        <p className={styles.popoverLabel}>Have a table code?</p>
        <JoinForm size="compact" autoFocus />
      </div>
    </>
  );
}
