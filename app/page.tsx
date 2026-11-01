import Link from "next/link";
import { redirect } from "next/navigation";
import { openExampleRetro } from "@/app/auth-actions";
import { LOCAL_SIGN_IN_ENABLED } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/dal";
import { exampleRetro } from "@/lib/auth/local";
import { JoinForm } from "./join-form";
import styles from "./page.module.css";

const SITE = "https://tabletopretro.com";

export default async function Home() {
  if (await getCurrentUser()) redirect("/library");
  // Only on a developer's machine (local sign-in), and only once the seed has run.
  const example = LOCAL_SIGN_IN_ENABLED && exampleRetro() !== null;
  return (
    <div className={styles.home}>
      <header className={styles.top}>
        {/* The mark leaves for the site; the words roll up to say so. */}
        <a className={styles.navMark} href={SITE} target="_blank" rel="noopener">
          <Mark small />
          <span className={styles.navRoll} aria-hidden>
            <span className={styles.navRollIn}>
              <span />
              <span>go to tabletopretro.com</span>
            </span>
          </span>
          <span className={styles.srOnly}>Go to tabletopretro.com</span>
        </a>
        <nav className={styles.right}>
          <Link className={styles.gh} href="/sign-in">
            Sign in
          </Link>
        </nav>
      </header>

      <main className={styles.col}>
        <div className={styles.lock}>
          <Mark />
          <h1 className={styles.wordmark}>
            Tabletop
            <br />
            Retro
          </h1>
        </div>

        <section className={styles.row} aria-labelledby="play-heading">
          <div>
            <span className={styles.tag}>Play</span>
            <h2 id="play-heading">Got a table code?</h2>
          </div>
          <JoinForm />
        </section>

        <section className={styles.row} aria-labelledby="build-heading">
          <div>
            <span className={styles.tag}>Build</span>
            <h2 id="build-heading">Write your first retro out of story pages and activities</h2>
          </div>
          <div className={styles.rowAction}>
            <Link className={`${styles.act} ${styles.buildAct}`} href="/sign-in">
              Sign in to build
            </Link>
            {example ? (
              <form action={openExampleRetro}>
                <button type="submit" className={styles.example}>
                  Or open the example retro and change it
                  <Arrow />
                </button>
              </form>
            ) : null}
          </div>
        </section>

      </main>
    </div>
  );
}

/** The two tilted frames and the gold square; the big lockup carries the letters too. */
function Mark({ small = false }: { small?: boolean }) {
  if (small) {
    return (
      <svg viewBox="0 0 128 108" className={styles.navIcon} aria-hidden>
        <rect x="70" y="44" width="43" height="48" rx="1.5" transform="rotate(18 91.5 68)" fill="var(--accent)" />
        <path
          d="M12 0H81Q83 0 83 2V62Q83 64 81 64H12Q10 64 10 62V2Q10 0 12 0Z M23 11H70Q72 11 72 13V51Q72 53 70 53H23Q21 53 21 51V13Q21 11 23 11Z"
          transform="translate(0 10) rotate(-9 46.5 32)"
          fill="var(--accent)"
          fillRule="evenodd"
        />
        <rect x="103" y="37" width="20" height="20" fill="var(--accent-2)" />
      </svg>
    );
  }
  return (
    <svg className={styles.mark} viewBox="0 0 694 446" role="img" aria-label="Tabletop Retro">
      <path fill="var(--accent)" d="M437 178L606 229Q613 231 611 239L561 421Q559 430 551 427L381 379Q373 377 376 369L429 184Q431 176 437 178Z" />
      <path fill="var(--accent)" d="M103 81L416 34Q425 32 427 41L464 285Q466 294 457 296L142 342Q133 344 131 335L95 91Q94 83 103 81Z" />
      <path fill="var(--bg)" d="M154 118L376 82Q385 80 387 90L413 248Q414 257 405 259L183 294Q174 296 172 287L146 129Q144 120 154 118Z" />
      <path fill="var(--fg)" d="M178 136L290 118L295 146L254 153L271 254L241 260L223 158L183 165Z" />
      <path
        fill="var(--fg)"
        d="M310 130L334 126L338 152L364 148L368 171L341 175L347 209C348 219 353 223 362 222L376 220L380 245L360 248C336 252 321 240 317 216L312 179L294 182L291 159L302 157C310 156 313 152 311 143Z"
      />
      <path
        fill="var(--bg)"
        fillRule="evenodd"
        d="M465 223L518 239C548 248 562 268 554 296C549 314 537 325 519 329L532 380L498 370L487 324L469 319L457 358L428 350ZM487 257L475 294L494 300C509 305 519 300 523 288C528 276 522 268 508 263Z"
      />
      <path fill="var(--accent-2)" d="M566 176H655V266H566Z" />
      <path
        fill="var(--accent-fg)"
        d="M592 188L604 187L604 198L613 192L619 202L609 208L620 212L614 223L605 217L605 228L594 229L593 218L584 224L578 214L588 208L578 203L584 193L593 198Z"
      />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

