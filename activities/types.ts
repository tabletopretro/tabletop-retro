/**
 * The activity contract: each activity folder exports an ActivityDefinition (client) and an
 * ActivityServer. Shared by client and server: no Node APIs.
 */

import type { ComponentType } from "react";
import type { Character } from "@/lib/character-doc";
import type { Seat } from "@/lib/subjects";

/**
 * `type` is stored in campaign files: never rename or reuse an id. `timer` is seconds (0 = none);
 * `settings` holds the Table Lead's picks by key.
 */
export type ActivityConfig = {
  type: string;
  timer: number;
  settings: Record<string, string>;
};

/** An activity's own fields: its config minus the shared ones. */
export type OwnConfig<C extends ActivityConfig> = Omit<C, keyof ActivityConfig>;

/** Seconds; 0 is none. */
export const ACTIVITY_TIMERS = [0, 30, 60, 120, 180, 300, 600] as const;

/**
 * A choice the Table Lead makes when adding the activity. A missing or unknown pick falls back
 * to the first option.
 */
export type ActivitySetting = {
  key: string;
  label: string;
  options: readonly { value: string; label: string }[];
};

/** The config's settings with defaults filled in and unknown values dropped. */
export function resolveSettings(settings: readonly ActivitySetting[], stored: Readonly<Record<string, string>>) {
  const out: Record<string, string> = {};
  for (const setting of settings) {
    const value = stored[setting.key];
    out[setting.key] = setting.options.some((o) => o.value === value) ? value : setting.options[0].value;
  }
  return out;
}

/** The current activity as sent to one viewer (seat null: the Table Lead); `data` is the activity's `view`. */
export type ActivityFeed<D = unknown> = {
  slide: string;
  type: string;
  /** The Table Lead has put the results on everyone's screen. */
  shown: boolean;
  /** Seconds the timer runs, how much is left as this was sent, and whether it's started. */
  timer: { total: number; remainingMs: number; running: boolean } | null;
  /** No more input: the timer's out. */
  locked: boolean;
  /** How many seats have taken part, for "3 of 5 answered". */
  answered: number;
  data: D;
};

/** `receivedAt` is performance.now() on arrival, so timers count from the right moment. */
export type LiveActivity<D = unknown> = ActivityFeed<D> & { receivedAt: number };

export type ActivityResult = { ok: true } | { ok: false; error: string };

/** Who's at the table, by seat id, for naming results; rehearsing, the cast by character id. */
export type Names = {
  nameOf: (seatId: string) => string;
  /** Everyone an activity can involve, shaped like characters (see lib/subjects.ts). */
  subjects: Character[];
};

/** The Table Lead's line to the open table: runs one of the activity's `lead` handlers. */
export type TableLink = {
  lead: (action: string, payload?: unknown) => Promise<ActivityResult>;
};

/** Per-slide state on the Table Lead's screen while rehearsing (no table open). */
export type LocalState = {
  value: unknown;
  set: (next: unknown) => void;
};

export type EditorProps<C extends ActivityConfig> = {
  campaignId: string;
  pageId: string;
  config: C;
  /** Typing: coalesced into one undo step. */
  onType: (next: C) => void;
  /** Picking, adding or removing: its own undo step. */
  onEdit: (next: C) => void;
};

/**
 * The Table Lead's stage slide, or a thumbnail when `live` is false (render a still).
 * `feed` and `table` are null rehearsing or in thumbnails.
 */
export type StageProps<C extends ActivityConfig, D> = {
  config: C;
  pageId: string;
  /** Where this viewer loads the campaign's media from. */
  mediaBase: string;
  live: boolean;
  feed: LiveActivity<D> | null;
  table: TableLink | null;
  local: LocalState;
  names: Names;
  /** Who's at the open table; null when it isn't. */
  seats: Seat[] | null;
};

/** The slide on a player's own device. `act` runs one of the activity's `player` handlers. */
export type PlayProps<C extends ActivityConfig, D> = {
  config: C;
  pageId: string;
  mediaBase: string;
  feed: LiveActivity<D> | null;
  mySeat: string;
  names: Names;
  act: (action: string, payload?: unknown) => Promise<ActivityResult>;
};

/** What the activity adds to the Table Lead's "Table controls" panel. */
export type ControlsProps<C extends ActivityConfig, D> = {
  config: C;
  pageId: string;
  feed: LiveActivity<D> | null;
  table: TableLink | null;
  local: LocalState;
  names: Names;
  seats: Seat[] | null;
  /** How many are at the table; null when it isn't open. */
  seatCount: number | null;
};

type IconComponent = ComponentType<{ size?: number; className?: string }>;

export type ActivityDefinition<C extends ActivityConfig = ActivityConfig, D = unknown> = {
  /** Stored in campaign files as `type`: lowercase letters, digits, dashes. Forever. */
  id: string;
  name: string;
  /** One line for the catalog: what the table does. */
  blurb: string;
  Icon: IconComponent;
  /** The activity's own fields for a new page; the framework adds type, timer and settings. */
  make: () => OwnConfig<C>;
  /** Null when malformed. Never trust the shape; give older files defaults. */
  parse: (raw: Record<string, unknown>) => OwnConfig<C> | null;
  /** The Table Lead can set a countdown that starts when the page comes up at an open table. */
  timed: boolean;
  /** Settings the Table Lead picks in the editor; the framework renders them and stores the picks. */
  settings?: readonly ActivitySetting[];
  /**
   * Results header words: "3 of 5 {done}", the {show}/{hide} button, "Open the table to {none}".
   * Omit when there's nothing to reveal.
   */
  reveal?: { done: string; show: string; hide: string; none: string };
  /** The slide fills edge to edge (the activity draws its own frame). */
  bleed?: boolean;
  /** Whether clearing the activity loses anything the Table Lead wrote (asks first). */
  hasContent: (config: C) => boolean;
  /** A few words after the name in page labels, like the question. */
  summary?: (config: C) => string | null;
  /** Images in the campaign's images/ folder the config references, so saves don't prune them. */
  images?: (config: C) => string[];
  /** Why there's nothing to show yet ("No question written yet."), shown to the Table Lead only. */
  empty?: (config: C) => string | null;
  Editor: ComponentType<EditorProps<C>>;
  Stage: ComponentType<StageProps<C, D>>;
  Play: ComponentType<PlayProps<C, D>>;
  Controls?: ComponentType<ControlsProps<C, D>>;
};

/** A definition as the registry holds it, with its config and data types erased. */
export type AnyActivity = ActivityDefinition<ActivityConfig, unknown>;

/** Types a definition and erases it for the registry in one step. */
export function defineActivity<C extends ActivityConfig, D>(definition: ActivityDefinition<C, D>): AnyActivity {
  return definition as unknown as AnyActivity;
}

/** One row of the activity's responses store: a seat's answer (text), choice (number), or both. */
export type ActivityResponse = {
  id: string;
  seatId: string;
  answer: string | null;
  choice: number | null;
  createdAt: Date;
};

/** Durable per-seat responses for the current slide. Richer state can go in `state`. */
export type ActivityStore = {
  rows: () => ActivityResponse[];
  insert: (values: { seatId: string; answer?: string | null; choice?: number | null }) => void;
  update: (id: string, values: { answer?: string | null; choice?: number | null }) => void;
  remove: (id: string) => void;
  /** Runs `work` in one transaction; synchronous, so nothing slips in between. */
  transaction: <T>(work: () => T) => T;
};

/** What an activity's server handlers get: the table, the slide, its config, and ways to read and write. */
export type ServerContext<C extends ActivityConfig = ActivityConfig> = {
  tableId: string;
  slide: string;
  config: C;
  /** The timer, if any, has run out (with a moment's grace for input sent just as it did). */
  locked: boolean;
  /** Who's at the table, in the order they sat down. */
  seats: Seat[];
  /** The activity's live state for this slide, kept with the table and sent to every screen on change. */
  state: <S>() => S | null;
  setState: <S>(next: S | null) => void;
  store: ActivityStore;
  /** Tells every screen at the table to refetch. setState and the store already do. */
  publish: () => void;
};

export type ActivityServer<C extends ActivityConfig = ActivityConfig, D = unknown> = {
  /**
   * What this viewer (seat null: the Table Lead) gets. Send players only their own input,
   * and everyone's once `shown`.
   */
  view: (ctx: ServerContext<C>, seatId: string | null, shown: boolean) => { answered: number; data: D };
  /** What a seated player can do, by action name. Payloads are untrusted. */
  player?: Record<string, (ctx: ServerContext<C>, seatId: string, payload: unknown) => ActivityResult>;
  /** What the Table Lead can do, by action name. Payloads are untrusted. */
  lead?: Record<string, (ctx: ServerContext<C>, payload: unknown) => ActivityResult>;
};

export type AnyActivityServer = ActivityServer<ActivityConfig, unknown>;

export function defineActivityServer<C extends ActivityConfig, D>(server: ActivityServer<C, D>): AnyActivityServer {
  return server as unknown as AnyActivityServer;
}
