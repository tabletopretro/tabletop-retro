"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./tooltip.module.css";

const SHOW_DELAY_MS = 350;
const GAP = 10;
/** Within this many px of a viewport edge, a top/bottom tip aligns to the anchor's edge instead of centring. */
const EDGE = 140;

type Side = "right" | "bottom" | "top";
type Placement = { top: number; left: number; transform: string; side: Side };

/** Use instead of `title`. A manual popover in the top layer, so containers can't clip it and it shows above modal dialogs. */
export function Tooltip({
  content,
  children,
  side = "right",
  delay = SHOW_DELAY_MS,
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: Side;
  delay?: number;
  className?: string;
}) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [placement, setPlacement] = useState<Placement | null>(null);

  function open() {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (side === "right") {
      setPlacement({ top: rect.top + rect.height / 2, left: rect.right + GAP, transform: "translateY(-50%)", side });
      return;
    }
    const top = side === "bottom" ? rect.bottom + GAP : rect.top - GAP;
    const y = side === "bottom" ? "0" : "-100%";
    let left = rect.left + rect.width / 2;
    let x = "-50%";
    if (rect.right > window.innerWidth - EDGE) {
      left = rect.right;
      x = "-100%";
    } else if (rect.left < EDGE) {
      left = rect.left;
      x = "0";
    }
    setPlacement({ top, left, transform: `translate(${x}, ${y})`, side });
  }

  useEffect(() => {
    if (!placement) return;
    const tip = tipRef.current;
    try {
      if (tip && !tip.matches(":popover-open")) tip.showPopover();
    } catch {
      // No popover support: it still shows as a fixed element.
    }
  }, [placement]);

  function close() {
    window.clearTimeout(timer.current);
    setPlacement(null);
  }

  return (
    <span
      ref={anchorRef}
      className={className ? `${styles.anchor} ${className}` : styles.anchor}
      aria-describedby={placement ? id : undefined}
      onPointerEnter={() => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(open, delay);
      }}
      onPointerLeave={close}
      onPointerDown={close}
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) open();
      }}
      onBlur={close}
    >
      {children}
      {placement
        ? createPortal(
            <span
              ref={tipRef}
              id={id}
              role="tooltip"
              popover="manual"
              className={styles.tip}
              data-side={placement.side}
              style={{ top: placement.top, left: placement.left, transform: placement.transform }}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
