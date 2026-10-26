import Link from "next/link";
import { redirect } from "next/navigation";
import { NOT_OPEN } from "@/lib/not-open";
import { playerAccess } from "@/lib/player-access";
import type { TableSnapshot } from "@/lib/tables";
import { JoinForm } from "../../join-form";
import { PlayerTable } from "./player-table";
import { SeatForm } from "./seat-form";
import { WaitForTable } from "./wait-for-table";
import styles from "../play.module.css";

export const metadata = { title: "At the table · Tabletop Retro" };

export default async function PlayPage({ params }: PageProps<"/play/[code]">) {
  const raw = (await params).code;
  const { code, table, seat, user } = await playerAccess(raw);
  // Codes in URLs can be in any case; redirect to the canonical form.
  if (code && code !== decodeURIComponent(raw)) redirect(`/play/${code}`);

  if (!table) {
    return (
      <main className={styles.center}>
        <p className={styles.eyebrow}>{code ?? "Table code"}</p>
        <h1 className={styles.title}>{NOT_OPEN}</h1>
        {code ? <WaitForTable code={code} /> : null}
        <JoinForm size="compact" />
        <Link href="/" className={styles.home}>
          Tabletop Retro
        </Link>
      </main>
    );
  }

  if (!seat) {
    return (
      <main className={styles.center}>
        <p className={styles.eyebrow}>{table.code}</p>
        <h1 className={styles.title}>{table.title}</h1>
        <SeatForm code={table.code} signedInAs={user?.name ?? null} />
      </main>
    );
  }

  return (
    <PlayerTable
      code={table.code}
      title={table.title}
      name={user?.name ?? seat.guestName ?? "Player"}
      seatId={seat.id}
      snapshot={table.snapshot as TableSnapshot}
      initialSlide={table.currentSlide}
    />
  );
}
