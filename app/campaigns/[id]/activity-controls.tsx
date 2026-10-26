"use client";

import { findActivity } from "@/activities";
import type { ActivityConfig, LiveActivity, LocalState, Names, TableLink } from "@/activities/types";
import type { Seat } from "@/lib/subjects";
import { ResetIcon } from "../../icons";
import { Tooltip } from "../../tooltip";
import styles from "./present.module.css";

export function ActivityControls({
  activity,
  pageId,
  feed,
  table,
  local,
  names,
  seats,
  onShow,
  onRestartTimer,
}: {
  activity: ActivityConfig;
  pageId: string;
  /** The current page's feed; null before it arrives or rehearsing. */
  feed: LiveActivity | null;
  table: TableLink | null;
  local: LocalState;
  names: Names;
  seats: Seat[] | null;
  onShow: (shown: boolean) => void;
  onRestartTimer: () => void;
}) {
  const definition = findActivity(activity.type);
  if (!definition) return <p className={styles.tableEmpty}>This activity isn&apos;t available any more.</p>;
  const seatCount = seats ? seats.length : null;
  const { reveal } = definition;
  if (reveal && seatCount === null) {
    return <p className={styles.tableEmpty}>Open the table to {reveal.none}.</p>;
  }
  const own = definition.Controls ? (
    <definition.Controls
      config={activity}
      pageId={pageId}
      feed={feed}
      table={table}
      local={local}
      names={names}
      seats={seats}
      seatCount={seatCount}
    />
  ) : null;
  if (!reveal) return own ?? <p className={styles.tableEmpty}>None for this page.</p>;
  return (
    <div className={styles.responses}>
      <div className={styles.responsesHead}>
        <span className={styles.seatsLabel}>
          {feed?.answered ?? 0} of {seatCount} {reveal.done}
        </span>
        <span className={styles.responsesTools}>
          {definition.timed && activity.timer > 0 ? (
            <Tooltip content="Restart timer" side="top">
              <button type="button" className={styles.iconTool} aria-label="Restart timer" onClick={onRestartTimer}>
                <ResetIcon size={16} />
              </button>
            </Tooltip>
          ) : null}
          <button
            type="button"
            className={styles.showButton}
            aria-pressed={feed?.shown ?? false}
            disabled={!feed}
            onClick={() => onShow(!feed?.shown)}
          >
            {feed?.shown ? reveal.hide : reveal.show}
          </button>
        </span>
      </div>
      {own}
    </div>
  );
}
