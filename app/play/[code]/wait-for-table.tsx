"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 5000;

/** Reloads the page once the table opens, so a player who arrived early just waits. */
export function WaitForTable({ code }: { code: string }) {
  const router = useRouter();
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const res = await fetch(`/play/${code}/state`, { cache: "no-store" });
        const state = (await res.json()) as { open?: boolean };
        if (live && state.open) router.refresh();
      } catch {
        // Offline for a moment: try again next tick.
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [code, router]);
  return null;
}
