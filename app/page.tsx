import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { JoinForm } from "./join-form";
import styles from "./page.module.css";

export default async function Home() {
  if (await getCurrentUser()) redirect("/library");
  return (
    <div className={styles.home}>
      <Masthead />
      <SignedOut />
    </div>
  );
}

function Masthead() {
  return (
    <header className={styles.mast}>
      <div className={styles.col}>
        <Link className={styles.wordmark} href="/">
          <Die />
          Tabletop Retro
        </Link>
        <nav className={styles.nav}>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </div>
    </header>
  );
}

function SignedOut() {
  return (
    <main>
      <div className={styles.band}>
        <div className={styles.col}>
          <div>
            <p className={styles.label}>
              <b>P1</b>Player
            </p>
            <h1 className={styles.title}>Enter your table code</h1>
          </div>
          <JoinForm />
        </div>
      </div>
      <div className={`${styles.band} ${styles.tl}`}>
        <div className={styles.col}>
          <div>
            <p className={styles.label}>
              <b>TL</b>Table Lead
            </p>
            <h2 className={styles.title} style={{ fontSize: 36 }}>
              Write a campaign, open a table
            </h2>
          </div>
          <div>
            <Link className={`${styles.btn} ${styles.solid}`} href="/sign-in">
              Sign in
              <Arrow />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Die() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" fill="var(--accent)" />
      <g fill="var(--accent-ink)">
        <rect x="5" y="13" width="6" height="6" />
        <rect x="13" y="9" width="6" height="6" />
        <rect x="13" y="17" width="6" height="6" />
        <rect x="21" y="5" width="6" height="6" />
        <rect x="21" y="13" width="6" height="6" />
        <rect x="21" y="21" width="6" height="6" />
      </g>
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}
