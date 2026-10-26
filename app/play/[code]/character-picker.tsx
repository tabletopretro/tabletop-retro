"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { UNTITLED_CHARACTER, type Character } from "@/lib/character-doc";
import { CharacterPortrait } from "../../characters/character-portrait";
import type { Seat } from "@/lib/subjects";
import { pickCharacterAction } from "./actions";
import styles from "../play.module.css";

export function CharacterPicker({
  open,
  code,
  cast,
  seats,
  mySeat,
  onClose,
}: {
  open: boolean;
  code: string;
  cast: Character[];
  seats: Seat[];
  mySeat: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const mine = seats.find((s) => s.id === mySeat)?.characterId ?? null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  function pick(characterId: string | null) {
    startTransition(async () => {
      setError(null);
      try {
        const result = await pickCharacterAction(code, characterId);
        if (result.ok) onClose();
        else setError(result.error);
      } catch {
        setError("Couldn't reach the table. Try again.");
      }
    });
  }

  return (
    <dialog
      ref={ref}
      className={styles.soundDialog}
      aria-labelledby="character-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id="character-title" className={styles.soundTitle}>
        Who are you playing?
      </h2>
      <ul className={styles.characterList}>
        {cast.map((character) => {
          const takenBy = seats.find((s) => s.characterId === character.id && s.id !== mySeat);
          return (
            <li key={character.id}>
              <button
                type="button"
                className={styles.characterOption}
                aria-pressed={mine === character.id}
                disabled={pending || Boolean(takenBy)}
                onClick={() => pick(character.id)}
              >
                <CharacterPortrait character={character} size={36} />
                <span className={styles.characterName}>{character.name.trim() || UNTITLED_CHARACTER}</span>
                {takenBy ? <span className={styles.takenBy}>{takenBy.name}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.error} aria-live="polite">
        {error}
      </p>
      <div className={styles.soundActions}>
        {mine ? (
          <button type="button" className={styles.quiet} disabled={pending} onClick={() => pick(null)}>
            Let them go
          </button>
        ) : null}
        <button type="button" className={styles.quiet} onClick={onClose}>
          {mine ? "Done" : "Not yet"}
        </button>
      </div>
    </dialog>
  );
}
