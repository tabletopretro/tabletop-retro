import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAsLocalUser } from "@/app/auth-actions";
import { LOCAL_SIGN_IN_ENABLED } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/dal";
import { listLocalUsers } from "@/lib/auth/local";
import { NewLocalUserForm } from "./new-local-user-form";
import styles from "./page.module.css";
import ui from "../ui.module.css";

export const metadata: Metadata = { title: "Sign in · Tabletop Retro" };

export default async function SignInPage() {
  if (await getCurrentUser()) redirect("/library");
  const localUsers = LOCAL_SIGN_IN_ENABLED ? listLocalUsers() : [];

  return (
    <div className={styles.page}>
      <header className={styles.mast}>
        <Link href="/" className={styles.wordmark}>
          Tabletop Retro
        </Link>
      </header>

      <main className={styles.panel}>
        <h1 className={styles.title}>Sign in</h1>

        {!LOCAL_SIGN_IN_ENABLED ? (
          <p className={styles.closed}>
            Sign-in isn&apos;t set up on this server yet. See docs/architecture.md for wiring an identity
            provider.
          </p>
        ) : null}

        {LOCAL_SIGN_IN_ENABLED ? (
          <section className={styles.local} aria-labelledby="local-heading">
            <p id="local-heading" className={styles.eyebrow}>
              Local
            </p>
            {localUsers.length > 0 ? (
              <ul className={styles.users}>
                {localUsers.map((u) => (
                  <li key={u.id}>
                    <form action={signInAsLocalUser}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit" className={ui.secondary}>
                        {u.name}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
            <NewLocalUserForm />
          </section>
        ) : null}
      </main>
    </div>
  );
}
