import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/dal";
import { AccountBar } from "../campaigns/account-bar";
import shared from "../campaigns/campaign.module.css";
import { LibraryTabs } from "./library-tabs";
import styles from "./library.module.css";

export default async function LibraryLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className={shared.page}>
      <header className={shared.mast}>
        <Link href="/" className={shared.wordmark}>
          Tabletop Retro
        </Link>
        <AccountBar user={user} />
      </header>
      <div className={styles.library}>
        <LibraryTabs />
        <main>{children}</main>
      </div>
    </div>
  );
}
