import type { Character } from "@/lib/character-doc";
import { PersonIcon } from "../icons";
import styles from "./character.module.css";

/** `null` is a reference whose character left the cast or was deleted: a blank figure. */
export function CharacterPortrait({ character, size }: { character: Character | null; size: number }) {
  const box = { width: size, height: size };
  if (!character) {
    return (
      <span className={`${styles.portrait} ${styles.portraitUnnamed}`} style={box} aria-hidden>
        <PersonIcon size={Math.round(size * 0.6)} />
      </span>
    );
  }
  if (character.portrait) {
    return (
      // Owner-only route with private caching; next/image would proxy it
      // through the optimizer without the session.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/characters/${character.id}/images/${character.portrait}`}
        alt=""
        className={styles.portrait}
        style={box}
      />
    );
  }
  const initial = character.name.trim().charAt(0).toLocaleUpperCase();
  return (
    <span className={styles.portrait} style={{ ...box, fontSize: Math.round(size * 0.45) }} aria-hidden>
      {initial || <PersonIcon size={Math.round(size * 0.6)} />}
    </span>
  );
}
