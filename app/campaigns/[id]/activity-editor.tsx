"use client";

import { useState } from "react";
import { ACTIVITIES, activityHasContent, activityName, findActivity, makeActivity } from "@/activities";
import { Segmented, Setting, Setup } from "@/activities/kit/editor";
import { ACTIVITY_TIMERS, resolveSettings, type ActivityConfig } from "@/activities/types";
import type { CampaignPage } from "@/lib/campaign-doc";
import { ConfirmDialog } from "./confirm-dialog";
import styles from "./editor.module.css";

type PagePatch = Partial<Omit<CampaignPage, "id">>;

export function ActivityEditor({
  campaignId,
  page,
  onChange,
  onStructuralChange,
}: {
  campaignId: string;
  page: CampaignPage;
  /** Typing: coalesced into one undo step. */
  onChange: (patch: PagePatch) => void;
  /** Picking, adding or removing, a setting: its own undo step. */
  onStructuralChange: (pageId: string, patch: PagePatch) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const activity = page.activity;
  const set = (next: ActivityConfig | null) => onStructuralChange(page.id, { activity: next });

  if (!activity) {
    return (
      <ul className={styles.catalog} aria-label="Activities">
        {ACTIVITIES.map((entry) => (
          <li key={entry.id}>
            <button type="button" className={styles.catalogItem} onClick={() => set(makeActivity(entry))}>
              <span className={styles.catalogName}>
                <entry.Icon size={18} />
                {entry.name}
              </span>
              <span className={styles.catalogBlurb}>{entry.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  const definition = findActivity(activity.type);

  return (
    <div className={styles.activityBody}>
      <div className={styles.activityHead}>
        <span className={styles.activityTag}>{activityName(activity)}</span>
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => (activityHasContent(activity) ? setConfirming(true) : set(null))}
        >
          Change activity
        </button>
      </div>

      {definition ? (
        <>
          <definition.Editor
            campaignId={campaignId}
            pageId={page.id}
            config={activity}
            onType={(next) => onChange({ activity: next })}
            onEdit={set}
          />
          {definition.settings?.length ? (
            <Setup>
              {definition.settings.map((setting) => (
                <Setting key={setting.key} id={`setting-${page.id}-${setting.key}`} label={setting.label}>
                  <Segmented
                    labelledBy={`setting-${page.id}-${setting.key}`}
                    value={resolveSettings(definition.settings ?? [], activity.settings)[setting.key]}
                    options={setting.options}
                    onChange={(value) => set({ ...activity, settings: { ...activity.settings, [setting.key]: value } })}
                  />
                </Setting>
              ))}
            </Setup>
          ) : null}
          {definition.timed ? (
            <Setting id={`timer-${page.id}`} label="Timer">
              <Segmented
                labelledBy={`timer-${page.id}`}
                value={activity.timer}
                options={ACTIVITY_TIMERS.map((seconds) => ({ value: seconds, label: timerLabel(seconds) }))}
                onChange={(timer) => set({ ...activity, timer })}
              />
            </Setting>
          ) : null}
        </>
      ) : (
        <p className={styles.unavailable}>This activity isn&apos;t available in this version. Pick another activity.</p>
      )}

      <ConfirmDialog
        open={confirming}
        title="Change the activity?"
        confirmLabel="Change activity"
        onConfirm={() => {
          setConfirming(false);
          set(null);
        }}
        onClose={() => setConfirming(false)}
      >
        What you wrote here will be cleared. ⌘Z brings it back.
      </ConfirmDialog>
    </div>
  );
}

export function timerLabel(seconds: number) {
  if (seconds === 0) return "Off";
  return seconds < 60 ? `${seconds}s` : `${seconds / 60} min`;
}
