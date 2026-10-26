"use client";

import { UNTITLED_CHARACTER } from "@/lib/character-doc";
import { CharacterPortrait } from "../characters/character-portrait";
import { CloseIcon, ReleaseIcon } from "../icons";
import { Tooltip } from "../tooltip";
import type { SeatView } from "@/lib/subjects";
import styles from "./seat-identity.module.css";

/** Portrait images aren't shown at the table, only icons (see tableSubjects). */
export function SeatIdentity({ seat, size = 32 }: { seat: SeatView; size?: number }) {
  const character = seat.character ? { ...seat.character, portrait: null } : null;
  return (
    <>
      <CharacterPortrait character={character} size={size} />
      <span className={styles.names}>
        <span className={styles.primary}>
          {seat.character ? seat.character.name.trim() || UNTITLED_CHARACTER : seat.player}
        </span>
        <span className={styles.secondary}>{seat.character ? seat.player : "No character"}</span>
      </span>
    </>
  );
}

export function ReleaseCharacter({ seat, onRelease }: { seat: SeatView; onRelease: (seatId: string) => void }) {
  if (!seat.character) return null;
  const name = seat.character.name.trim() || UNTITLED_CHARACTER;
  return (
    <Tooltip content={`Free ${name} for someone else`} side="top">
      <button
        type="button"
        className={styles.release}
        aria-label={`Free ${name} from ${seat.player}`}
        onClick={() => onRelease(seat.id)}
      >
        <ReleaseIcon size={16} />
      </button>
    </Tooltip>
  );
}

/** The caller confirms first. */
export function RemoveSeat({ seat, onRemove }: { seat: SeatView; onRemove: (seat: SeatView) => void }) {
  return (
    <Tooltip content="Remove from table" side="top">
      <button type="button" className={styles.release} aria-label={`Remove ${seat.player} from the table`} onClick={() => onRemove(seat)}>
        <CloseIcon size={16} />
      </button>
    </Tooltip>
  );
}
