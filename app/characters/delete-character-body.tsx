import { UNNAMED_CHARACTER, type Character } from "@/lib/character-doc";
import styles from "./character.module.css";

export function DeleteCharacterBody({ character }: { character: Character }) {
  const count = character.campaigns.length;
  return (
    <>
      {count > 0 ? (
        <>
          <span className={styles.deleteLead}>
            This character will be removed from the following {count === 1 ? "campaign" : "campaigns"}:
          </span>
          <ul className={styles.deleteList}>
            {character.campaigns.map((c) => (
              <li key={c.id} className={styles.deleteCampaign}>
                <span className={styles.deleteCover} aria-hidden>
                  {c.title.charAt(0).toUpperCase()}
                </span>
                <span className={styles.deleteTitle}>{c.title}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <span className={styles.deleteNote}>
        Their lines stay, as “{UNNAMED_CHARACTER}.” This can&apos;t be undone.
      </span>
    </>
  );
}
