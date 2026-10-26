import { requireUser } from "@/lib/auth/dal";
import { listCharacters } from "@/lib/characters";
import Link from "next/link";
import { PlusIcon } from "../../icons";
import styles from "../library.module.css";
import { CharacterCards } from "./character-cards";

export const metadata = { title: "Characters · Tabletop Retro" };

export default async function CharactersPage() {
  const user = await requireUser();
  const characters = listCharacters(user.id);

  return (
    <>
      <h1 className={styles.srOnly}>Characters</h1>
      <CharacterCards characters={characters}>
        <li>
          <Link href="/library/characters/new" className={`${styles.card} ${styles.newCard}`}>
            <span className={`${styles.cover} ${styles.newCover}`} aria-hidden>
              <PlusIcon size={32} />
            </span>
            <span className={styles.title}>New character</span>
          </Link>
        </li>
      </CharacterCards>
    </>
  );
}
