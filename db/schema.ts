import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  /** Null for local-only users; SSO users always have one. */
  email: text("email").unique(),
  avatarUrl: text("avatar_url"),
  createdAt: createdAt(),
});

/** SSO finds identities by (provider, provider_account_id); never auto-link to a user by email. */
export const accounts = sqliteTable(
  "accounts",
  {
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_idx").on(t.userId),
  ],
);

/** `id` is the SHA-256 of the cookie's token; the token itself is never stored. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Chapters and pages live in JSON under content/campaigns/<contentPath>/. */
export const campaigns = sqliteTable(
  "campaigns",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    contentPath: text("content_path").notNull().unique(),
    /** Permanent code; null until first claimed. */
    tableCode: text("table_code").unique(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [index("campaigns_owner_idx").on(t.ownerId)],
);

/** `campaign_characters` mirrors each campaign's `cast` so usage is a query. */
export const characters = sqliteTable(
  "characters",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    notes: text("notes").notNull().default(""),
    portrait: text("portrait"),
    artwork: text("artwork"),
    /** The TL's own label/value pairs, as JSON: [{ label, value }]. */
    fields: text("fields", { mode: "json" }).$type<unknown>(),
    /** A built-in icon id from lib/character-doc.ts, shown when there's no image. */
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [index("characters_owner_idx").on(t.ownerId)],
);

/** Which campaigns' casts include which characters. Rewritten on every save. */
export const campaignCharacters = sqliteTable(
  "campaign_characters",
  {
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.campaignId, t.characterId] }),
    index("campaign_characters_character_idx").on(t.characterId),
  ],
);

export const TABLE_STATES = ["open", "closed"] as const;
export type TableState = (typeof TABLE_STATES)[number];

/** `snapshot`: the players' copy of the campaign, TL-only notes left out. */
export const tables = sqliteTable(
  "tables",
  {
    id: id(),
    code: text("code").notNull(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    tlUserId: text("tl_user_id")
      .notNull()
      .references(() => users.id),
    state: text("state", { enum: TABLE_STATES }).notNull().default("open"),
    snapshot: text("snapshot", { mode: "json" }).notNull(),
    /** The slide the TL is on (a page id or `opener:<chapterId>`); players follow it. */
    currentSlide: text("current_slide"),
    /** { slide, playing, position (s), at (ms) }; null until something's played. */
    playback: text("playback", { mode: "json" }).$type<unknown>(),
    /** Live state everyone at the table sees: { shown, timers, activities } (LiveState in lib/tables.ts). */
    liveState: text("live_state", { mode: "json" }).$type<unknown>(),
    openedAt: createdAt(),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    // Codes are recycled: unique only among tables that aren't closed.
    uniqueIndex("tables_live_code_idx")
      .on(t.code)
      .where(sql`${t.state} != 'closed'`),
  ],
);

/** A player's place at a table: a signed-in user or a named guest. */
export const seats = sqliteTable(
  "seats",
  {
    id: id(),
    tableId: text("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id),
    guestName: text("guest_name"),
    /** SHA-256 of a guest's seat key (the cookie); seat ids are public at the table, keys aren't. */
    guestKeyHash: text("guest_key_hash").unique(),
    characterId: text("character_id"),
    joinedAt: createdAt(),
  },
  (t) => [
    uniqueIndex("seats_table_user_idx")
      .on(t.tableId, t.userId)
      .where(sql`${t.userId} is not null`),
  ],
);

/**
 * Players' responses on activity pages (the store in
 * lib/activity-runtime.ts): a text `answer` and a numeric `choice`, used
 * however the activity likes. Anonymous pages still record the seat so
 * people can edit their own answers and vote once; it is never sent to
 * anyone, the TL included.
 */
export const tableResponses = sqliteTable(
  "table_responses",
  {
    id: id(),
    tableId: text("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    slide: text("slide").notNull(),
    seatId: text("seat_id")
      .notNull()
      .references(() => seats.id, { onDelete: "cascade" }),
    answer: text("answer"),
    choice: integer("choice"),
    createdAt: createdAt(),
  },
  (t) => [index("table_responses_slide_idx").on(t.tableId, t.slide)],
);

/** Table chat. `name` is the sender at the time, kept when their seat goes (seat_id is then null). */
export const tableMessages = sqliteTable(
  "table_messages",
  {
    id: id(),
    tableId: text("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),
    seatId: text("seat_id").references(() => seats.id, { onDelete: "set null" }),
    fromLead: integer("from_lead", { mode: "boolean" }).notNull().default(false),
    name: text("name").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("table_messages_table_idx").on(t.tableId, t.createdAt)],
);

export type Session = typeof sessions.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Table = typeof tables.$inferSelect;
export type Seat = typeof seats.$inferSelect;
