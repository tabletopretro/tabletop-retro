"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import type { Character, CharacterPatch } from "@/lib/character-doc";
import { deleteCharacterAction, updateCharacterAction } from "../../../characters/actions";
import { CharacterEditor } from "../../../characters/character-editor";
import { DeleteCharacterBody } from "../../../characters/delete-character-body";
import { BackIcon } from "../../../icons";
import { Tooltip } from "../../../tooltip";
import { ConfirmDialog } from "../../../campaigns/[id]/confirm-dialog";
import styles from "../../library.module.css";

const AUTOSAVE_MS = 800;

type Status = "saved" | "dirty" | "saving" | "error";

export function CharacterPage({ initialCharacter }: { initialCharacter: Character }) {
  const router = useRouter();
  const [character, setCharacter] = useState(initialCharacter);
  const [status, setStatus] = useState<Status>("saved");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const pending = useRef<CharacterPatch>({});
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);
  const gone = useRef(false);

  async function save() {
    window.clearTimeout(timer.current);
    if (gone.current || inFlight.current || Object.keys(pending.current).length === 0) return;
    const patch = pending.current;
    pending.current = {};
    inFlight.current = true;
    setStatus("saving");
    let ok = false;
    try {
      const result = await updateCharacterAction(character.id, patch);
      ok = result.ok;
      if (!result.ok) setError(result.error);
    } catch {
      setError("Couldn't reach the server");
      pending.current = { ...patch, ...pending.current };
    }
    inFlight.current = false;
    if (!ok) return setStatus("error");
    setError(null);
    if (Object.keys(pending.current).length > 0) void save();
    else setStatus("saved");
  }

  function change(patch: CharacterPatch) {
    setCharacter((c) => ({ ...c, ...patch }));
    pending.current = { ...pending.current, ...patch };
    setStatus("dirty");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), AUTOSAVE_MS);
  }

  // Names save at once, outside the debounced edits.
  async function rename(name: string): Promise<string | null> {
    try {
      const result = await updateCharacterAction(character.id, { name });
      if (!result.ok) return result.error;
      setCharacter((c) => ({ ...c, name }));
      document.title = `${name || "Character"} · Tabletop Retro`;
      return null;
    } catch {
      return "Couldn't reach the server";
    }
  }

  const dirty = status !== "saved";
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (!gone.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // In-app navigation doesn't fire beforeunload, so save on the way out.
  const flush = useEffectEvent(() => void save());
  useEffect(() => () => flush(), []);

  function confirmDelete() {
    startDelete(async () => {
      try {
        const result = await deleteCharacterAction(character.id);
        if (!result.ok) return setConfirmError(result.error);
      } catch {
        return setConfirmError("Couldn't reach the server");
      }
      gone.current = true;
      window.clearTimeout(timer.current);
      router.push("/library/characters");
      router.refresh();
    });
  }

  const name = character.name.trim();

  return (
    <div className={styles.detail}>
      <div className={styles.detailBar}>
        <Link href="/library/characters" className={styles.back}>
          <BackIcon size={16} />
          Characters
        </Link>
        {status === "error" ? (
          <p className={styles.statusError} role="alert">
            <Tooltip content={error ?? "Couldn't save"} side="bottom">
              <span tabIndex={0}>Couldn&apos;t save</span>
            </Tooltip>
            <button type="button" className={styles.retry} onClick={() => void save()}>
              Retry
            </button>
          </p>
        ) : (
          <p className={styles.status} aria-live="polite">
            {status === "saved" ? "Saved" : "Saving…"}
          </p>
        )}
      </div>
      <CharacterEditor
        character={character}
        onRename={rename}
        onChange={change}
        onReplaced={(fresh) => setCharacter((c) => ({ ...c, portrait: fresh.portrait, artwork: fresh.artwork }))}
        onDelete={() => {
          setConfirmError(null);
          setConfirmOpen(true);
        }}
      />
      <ConfirmDialog
        open={confirmOpen}
        title={`Delete ${name || "this character"}?`}
        confirmLabel="Delete character"
        pending={deleting}
        error={confirmError}
        onConfirm={confirmDelete}
        onClose={() => setConfirmOpen(false)}
      >
        <DeleteCharacterBody character={character} />
      </ConfirmDialog>
    </div>
  );
}
