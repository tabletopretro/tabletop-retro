import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { campaignsForOwner } from "@/lib/home-data";
import { PlusIcon } from "../icons";
import styles from "./library.module.css";

export const metadata = { title: "Campaigns · Tabletop Retro" };

const edited = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export default async function CampaignsPage() {
  const user = await requireUser();
  const campaigns = campaignsForOwner(user.id);

  return (
    <>
      <h1 className={styles.srOnly}>Campaigns</h1>
      <ul className={styles.grid}>
        {campaigns.map((c) => (
          <li key={c.id}>
            <Link href={`/campaigns/${c.id}`} className={styles.card}>
              <span className={styles.cover} aria-hidden>
                {c.title.charAt(0).toUpperCase()}
              </span>
              <span className={styles.title}>{c.title}</span>
              <span className={styles.meta}>Edited {edited.format(c.updatedAt)}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/campaigns/new" className={`${styles.card} ${styles.newCard}`}>
            <span className={`${styles.cover} ${styles.newCover}`} aria-hidden>
              <PlusIcon size={32} />
            </span>
            <span className={styles.title}>New campaign</span>
          </Link>
        </li>
      </ul>
    </>
  );
}
