import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { NewCampaignForm } from "../../new-campaign-form";
import { AccountBar } from "../account-bar";
import styles from "../campaign.module.css";

export const metadata = { title: "New campaign · Tabletop Retro" };

export default async function NewCampaignPage() {
  const user = await requireUser();

  return (
    <div className={styles.page}>
      <header className={styles.mast}>
        <Link href="/" className={styles.wordmark}>
          Tabletop Retro
        </Link>
        <AccountBar user={user} />
      </header>
      <main className={styles.panel}>
        <h1 className={styles.title}>New campaign</h1>
        <NewCampaignForm autoFocus />
      </main>
    </div>
  );
}
