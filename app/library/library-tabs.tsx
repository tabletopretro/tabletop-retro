"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./library.module.css";

const TABS = [
  { href: "/library", label: "Campaigns" },
  { href: "/library/characters", label: "Characters" },
  { href: "/library/activities", label: "Activities" },
] as const;

export function LibraryTabs() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/library" ? pathname === "/library" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav className={styles.tabs} aria-label="Library">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={styles.tab}
          aria-current={active(tab.href) ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
