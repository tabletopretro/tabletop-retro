import { ACTIVITIES } from "@/activities";
import { CheckIcon } from "../../icons";
import { Tooltip } from "../../tooltip";
import styles from "../library.module.css";

export const metadata = { title: "Activities · Tabletop Retro" };

export default function ActivitiesPage() {
  return (
    <>
      <h1 className={styles.srOnly}>Activities</h1>
      <ul className={styles.grid}>
        {ACTIVITIES.map(({ id, name, blurb, Icon }) => (
          <li key={id} className={styles.fixedCard}>
            <span className={`${styles.cover} ${styles.fixedCover}`}>
              <span className={styles.defaultTag}>Built in</span>
              <Icon size={40} />
            </span>
            <span className={styles.title}>{name}</span>
            <span className={styles.meta}>{blurb}</span>
            <Tooltip content="On every activity page" side="top">
              <span className={styles.added} tabIndex={0}>
                <CheckIcon size={14} />
                Added
              </span>
            </Tooltip>
          </li>
        ))}
      </ul>
    </>
  );
}
