"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { UNTITLED_CHARACTER, type Character } from "@/lib/character-doc";
import { ConfirmDialog } from "../../campaigns/[id]/confirm-dialog";
import { deleteCharacterAction } from "../../characters/actions";
import { CharacterPortrait } from "../../characters/character-portrait";
import { DeleteCharacterBody } from "../../characters/delete-character-body";
import { TrashIcon } from "../../icons";
import { Tooltip } from "../../tooltip";
import styles from "../library.module.css";

export function CharacterCards({ characters, children }: { characters: Character[]; children: ReactNode }) {
  const router = useRouter();
  const [target, setTarget] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  function confirm() {
    if (!target) return;
    startDelete(async () => {
      try {
        const result = await deleteCharacterAction(target.id);
        if (!result.ok) return setError(result.error);
      } catch {
        return setError("Couldn't reach the server");
      }
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <ul className={styles.grid}>
      {characters.map((c) => {
        const name = c.name.trim();
        return (
          <li key={c.id} className={styles.cardSlot}>
            <Link href={`/library/characters/${c.id}`} className={styles.card}>
              {c.artwork ? (
                // Owner-only route with private caching; see character-portrait.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/characters/${c.id}/images/${c.artwork}`}
                  alt=""
                  className={`${styles.cover} ${styles.artworkCover}`}
                />
              ) : (
                <span className={`${styles.cover} ${styles.portraitCover}`} aria-hidden>
                  <CharacterPortrait character={c} size={96} />
                </span>
              )}
              <span className={styles.title} data-empty={name ? undefined : ""}>
                {name || UNTITLED_CHARACTER}
              </span>
            </Link>
            <Tooltip content="Delete character" side="top" className={styles.cardAction}>
              <button
                type="button"
                className={styles.cardDelete}
                aria-label={`Delete ${name || "this character"}`}
                onClick={() => {
                  setError(null);
                  setTarget(c);
                }}
              >
                <TrashIcon size={16} />
              </button>
            </Tooltip>
          </li>
        );
      })}
      {children}
      </ul>
      <ConfirmDialog
        open={target !== null}
        title={`Delete ${target?.name.trim() || "this character"}?`}
        confirmLabel="Delete character"
        pending={deleting}
        error={error}
        onConfirm={confirm}
        onClose={() => setTarget(null)}
      >
        {target ? <DeleteCharacterBody character={target} /> : null}
      </ConfirmDialog>
    </>
  );
}
