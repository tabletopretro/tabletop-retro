"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CHARACTER_LIMITS, characterNameError, normalizeCharacterName } from "@/lib/character-doc";
import editor from "../../../campaigns/[id]/editor.module.css";
import { createCharacterAction } from "../../../characters/actions";
import styles from "../../../characters/character.module.css";
import { BackIcon, CheckIcon } from "../../../icons";
import { Tooltip } from "../../../tooltip";
import library from "../../library.module.css";

export function NewCharacterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save() {
    const clean = normalizeCharacterName(name);
    const invalid = characterNameError(clean);
    if (invalid) return setError(invalid);
    startSaving(async () => {
      try {
        const result = await createCharacterAction(clean);
        if (!result.ok) return setError(result.error);
        router.replace(`/library/characters/${result.character.id}`);
      } catch {
        setError("Couldn't reach the server");
      }
    });
  }

  return (
    <div className={library.detail}>
      <div className={library.detailBar}>
        <Link href="/library/characters" className={library.back}>
          <BackIcon size={16} />
          Characters
        </Link>
      </div>
      <form
        className={`${editor.pageEditor} ${styles.head}`}
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className={styles.nameRow}>
          <input
            className={`${styles.name} ${styles.nameInput}`}
            value={name}
            maxLength={CHARACTER_LIMITS.nameLength}
            placeholder="Character name"
            aria-label="Character name"
            aria-invalid={error ? true : undefined}
            autoFocus
            readOnly={saving}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          <Tooltip content="Create · Enter" side="bottom">
            <button type="submit" className={styles.nameAction} data-save="" disabled={saving} aria-label="Create character">
              <CheckIcon size={18} />
            </button>
          </Tooltip>
          {error ? (
            <p className={`${editor.fieldError} ${styles.nameError}`} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
