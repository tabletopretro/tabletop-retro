/** The activity registry: add an activity to ACTIVITIES (catalog order). Shared by client and server. */

import { ACTIVITY_TIMERS, resolveSettings, type ActivityConfig, type AnyActivity } from "./types";
import { qa } from "./qa/definition";
import { vote } from "./vote/definition";
import { dice } from "./dice/definition";

export const ACTIVITIES: readonly AnyActivity[] = [qa, vote, dice];

export function findActivity(type: string | null | undefined): AnyActivity | null {
  return ACTIVITIES.find((a) => a.id === type) ?? null;
}

/** The catalog name for a config, or a stand-in for one this build doesn't have. */
export function activityName(config: ActivityConfig) {
  return findActivity(config.type)?.name ?? "Unavailable activity";
}

export function activityHasContent(config: ActivityConfig | null) {
  if (!config) return false;
  return findActivity(config.type)?.hasContent(config) ?? false;
}

export function activitySummary(config: ActivityConfig): string | null {
  return findActivity(config.type)?.summary?.(config) ?? null;
}

export function activityImages(config: ActivityConfig): string[] {
  return findActivity(config.type)?.images?.(config) ?? [];
}

export function activityTimer(config: ActivityConfig) {
  return findActivity(config.type)?.timed ? config.timer : 0;
}

export function makeActivity(definition: AnyActivity): ActivityConfig {
  return { type: definition.id, timer: 0, settings: {}, ...definition.make() };
}

const TYPE_PATTERN = /^[a-z0-9-]{1,40}$/;

/**
 * Null: no activity; undefined: malformed. Unknown but well-formed types are kept so files
 * survive builds without them.
 */
export function parseActivity(raw: unknown): ActivityConfig | null | undefined {
  if (raw == null) return null;
  if (typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const type = r.type;
  if (typeof type !== "string" || !TYPE_PATTERN.test(type)) return undefined;
  const timer = (ACTIVITY_TIMERS as readonly unknown[]).includes(r.timer) ? (r.timer as number) : 0;
  const settings = parseSettings(r.settings);
  if (!settings) return undefined;
  const definition = findActivity(type);
  if (!definition) return { type, timer, settings };
  const own = definition.parse(r);
  if (!own) return undefined;
  return {
    type,
    timer: definition.timed ? timer : 0,
    settings: definition.settings ? resolveSettings(definition.settings, settings) : {},
    ...own,
  };
}

/** Up to 10 short string settings with simple keys; older files have none. */
function parseSettings(raw: unknown): Record<string, string> | null {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 10) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!/^[a-z0-9-]{1,30}$/.test(key) || typeof value !== "string" || value.length > 40) return null;
    out[key] = value;
  }
  return out;
}
