# Architecture

Tabletop Retro is a **self-hosted** Next.js app: assume one organisation
runs it on its own server and disk. Durable data is SQLite (Drizzle +
better-sqlite3); campaigns are JSON files on disk; live table state goes
out over server-sent events from an in-process bus.

## Stack

- Next.js 16 App Router, React 19, TypeScript, CSS modules (no Tailwind).
  Fonts load through `next/font`. React Compiler is on.
- Drizzle ORM + better-sqlite3 (`db/schema.ts`, `db/index.ts`).
  `npm run db:push` syncs the schema into `dev.db`; run it again after
  any schema change.
- Port is always **1313** (`dev` / `start`).
- `npm install` on npm 11 only runs install scripts listed under
  `allowScripts` in `package.json`. `better-sqlite3` is native; if you add
  another package with a build step, approve it with
  `npm install-scripts approve <pkg>`.

### React conventions

- **No manual memoization.** The compiler handles it; don't write
  `useMemo`, `useCallback` or `memo` unless a profiler says so.
- **Page changes animate with `<ViewTransition>`.** Only structural
  changes run in `startTransition` with a transition type; typing never
  animates.
- **Event handlers read latest state via `useEffectEvent`.** SSE
  subscriptions in particular: subscribe once, read current props
  through the effect event, never reopen the stream per render.
- **Forms use Actions + `useActionState`** for pending and error state.
- **Hidden-but-alive UI uses `<Activity mode="hidden">`**: Edit and
  Present both stay mounted and share the selected page.

## Auth

Sign-in **fails closed**:

- **Local sign-in exists only under `next dev`** (`LOCAL_SIGN_IN_ENABLED`
  in `lib/auth/config.ts`). Pick a seeded user or type a new name, no
  passwords. Every function in `lib/auth/local.ts` refuses to run
  otherwise. There is no env flag to enable it in production; don't add
  one.
- **Production has no working sign-in until you wire an identity
  provider.** The sign-in page says so. When SSO lands, its callback
  verifies the identity, finds or creates the `accounts` row by
  `(provider, provider_account_id)`, then calls `createSession`
  (`lib/auth/session.ts`). Never auto-link an SSO identity to an existing
  user by email.
- **Sessions are database rows.** The cookie (`tr_session`: HttpOnly,
  SameSite=Lax, Secure in production) holds a random 256-bit token; the
  `sessions` table stores only its SHA-256. Sign-in replaces any existing
  session and prunes expired ones; sign-out deletes the row.
- **`getCurrentUser()` / `requireUser()` in `lib/auth/dal.ts` are the only
  auth checks.** `proxy.ts` merely redirects `/library` and `/campaigns`
  when no cookie exists; every protected page and action must still call
  `requireUser()`.
- **Every export in a `"use server"` file is a public endpoint.** Guard
  each one itself; don't rely on the UI hiding the button.
- **No return-to redirects** unless the target is validated as a
  same-origin relative path.
- Server actions get CSRF protection from Next (POST-only plus an
  Origin/Host check) with the SameSite cookie. Don't set
  `serverActions.allowedOrigins`.

Abuse limits (`lib/rate-limit.ts`, `lib/tables.ts`, `lib/storage.ts`):
joining is limited to 20 tries a minute and taking a seat to 12 per ten
minutes per client address (the first `X-Forwarded-For` entry, so the
proxy must set it), a table seats at most 50, guest names are made unique
and can't be the Table Lead's, and each owner's uploads share one storage
budget. The limiter is in-process, like the table bus. A wrong code and a
closed table get the same answer, so the join form never confirms a code.

## Vocabulary

Use these words everywhere: UI, identifiers, routes, docs.

| Word | Means |
| ---- | ----- |
| Campaign | What a Table Lead writes: chapters of pages, cast, art, soundtrack |
| Chapter | An ordered group of pages inside a campaign |
| Chapter opener | Optional title slide players see when a chapter begins. Belongs to the chapter, not its page list |
| Page | One screen the table sees. Numbered by position for display only ("1.2"); its identity is a generated id |
| Page name | Optional: the Table Lead's own label for a page (`title`). Players never see it; without one the **label** comes from the content (`page-label.ts`) |
| Heading | Optional, player-facing text, always above the image |
| Body text | The page's main text, shown to players (`text`) |
| Speaker notes | The Table Lead's notes for a page; never shown to players |
| Speaking line | A page kind: one character from the cast (`speakerId`) and what they say (`line`). Stored as kind `speech` |
| Activity | What an activity page runs, from the registry (`activities/`). One flat catalog |
| Character | A role in a campaign's story, from the Table Lead's library. A player *plays* a character |
| Cast | The characters one campaign uses, as ids in the campaign JSON |
| Unnamed character | How a reference reads when its character left the cast or was deleted. The reference is kept, never dropped |
| Table | One sitting of a campaign: opened by a Table Lead, joined with a code, holds the live state |
| Table Lead (TL) | Whoever opens a table |
| Player | Anyone who joins a table with its code |

A table is always in one of two states:

| State | Means | Entered by |
| ----- | ----- | ---------- |
| Open | Players can join with the code and pick characters, at any point | "Open table for players" in Present |
| Closed | Over; the code stops working, the record stays | "Close table" |

**Planned: In session.** A third state between the two, for once the
story has started: the Table Lead presses "Start the story", and from
then on a new player needs the Table Lead's say-so to sit down (let in
one by one, or late seats turned on for the table). It would go in
`TABLE_STATES` (`db/schema.ts`), be checked in `joinTable`
(`app/actions.ts`) and `takeSeatAction` (`app/play/[code]/actions.ts`),
and need a waiting state on the player side.

"Live" is fine as a casual badge for any table that isn't Closed, but it
is not a state. "Publish" is reserved for a future campaign-template
feature; never use it for making a table joinable.

## Library and campaigns

Home (`/`) is the signed-out page: the code field for players. Signing
in lands on the **library** (`/library`): Campaigns, Characters and
Activities tabs. Editors keep their own routes (`/campaigns/[id]`).

`createCampaign` in `lib/campaigns.ts` inserts the row and writes
`content/campaigns/<contentPath>/campaign.json` in one transaction. The
folder name is generated from the title plus a random suffix, never taken
raw from input. `content/campaigns/` is git-ignored because it pairs with
rows in the equally ignored `dev.db`. Campaign pages check ownership and
404 for anyone else's id. Titles are unique per owner (ignoring case and
spacing), checked inside the same synchronous transaction as the insert
or rename; the DB row owns the title and the JSON copy follows it.
Deleting a campaign removes the row and its folder, but is refused while
any table references it, since tables keep the history.

### The campaign document

`lib/campaign-doc.ts` holds the types, limits and `parseCampaignDoc`, the
only way anything from disk or the client becomes a `CampaignDoc`. Shared
client/server, so no Node APIs. New fields need a default in the parser
so older files still open. Activities inside it are parsed by the
registry (`activities/index.ts`): a well-formed type this build doesn't
have is kept as is, so a campaign never loses a page by being opened in
an older build.

### The editor

`/campaigns/[id]` (`app/campaigns/[id]/campaign-editor.tsx`) opens in edit
mode: outline on the left (cast, then chapters and pages, reorderable by
drag or Alt+↑/↓), the selected page on the right. Present is a separate
mode under `<Activity>` that shares the selection.

- **Saving.** The whole doc autosaves 800ms after the last edit, and on
  ⌘/Ctrl+S or leaving the page. `docRef` always holds the latest doc so
  async work never writes back a stale copy. Writes are temp-file + rename.
- **Undo.** ⌘Z / ⌘⇧Z step through up to 50 whole-document snapshots.
  Route every edit through `commit` and it's undoable for free; typing in
  a field coalesces into one step.
- **Actions** in `app/campaigns/[id]/actions.ts` each re-check the session
  and ownership, and treat ids and payloads as hostile.
- **Media.** Images (≤5 MB, typed by magic bytes, never SVG) live in the
  campaign's `images/`; videos (≤100 MB, MP4/WebM/MOV, streamed through
  `POST /uploads/video/[campaignId]`, served with Range support) in
  `videos/`; sounds (music and effects, ≤20 MB) in `sounds/`. All are
  served owner-only with `nosniff`, under random names. Saves prune
  unreferenced files older than 10 minutes except those the client lists
  in `keep` (still reachable by undo) and anything an open table's
  snapshot still shows. "Referenced" means `docImages` / `docVideos` /
  `docSounds`; an activity that holds an image declares it through
  `images()` in its definition.
- **Present mode** (`present-view.tsx`) plays like a slide deck: the
  current slide large (`PlayerScreen`, shared with the player view),
  navigation, a filmstrip of nearby slides, and on the right speaker
  notes, who's at the table, the table controls (what the current
  activity adds: `activity-controls.tsx`) and chat. Crossing a chapter is
  deliberate: forward keys stop at its last slide and Next becomes
  "Close Chapter N"; going back into a closed chapter asks first.

## Characters

Characters live in the owner's **character library**, not in a campaign:
a `characters` row (name, notes, portrait, optional artwork, custom
fields) with images under `content/characters/<id>/`. A
campaign's JSON has `cast: [characterId, …]` and `campaign_characters`
mirrors it so "which campaigns use this character?" is a query. Every
save runs `syncCast`, which keeps only the owner's own characters in the
cast. A character always has a real name (`characterNameError`). References
keep their id when the character leaves the cast or is deleted and render
as "Unnamed character"; never drop a reference because its character is
gone.

## Tables and the player side

- **Codes** (`lib/table-code.ts`): `KQXMB-274`, 5 letters + 3 digits from a
  readable alphabet, with a small word blocklist. Each campaign keeps
  **one code for good** (`campaigns.table_code`, unique), claimed on first
  use. It only lets players in while the campaign's table is open. "New
  code" in Settings retires it (refused while the table is open).
- **Presenting ≠ opening.** Present is the TL's view, private. "Open table
  for players" opens a table: it saves, snapshots the campaign
  (`snapshotOf`: page names, chapter titles, speaker, opener and
  character notes, portraits, artwork and fields left out, so players
  see each character's name only) and shows the code. One live
  table per campaign. Portraits on the player side are a gap, not a
  rule: sending them means serving them through the play media route.
  The snapshot holds every slide, including ones not shown yet;
  holding back future slides would mean serving them one at a time.
- **Edits go live on save.** While a table is open, every save refreshes
  its snapshot; the feed carries `snapshotAt` and players fetch
  `/play/[code]/snapshot` when it changes.
- **Players** (`app/play/[code]`): join from the home code field, take a
  seat (signed-in by account; guests by name, with a random seat
  key in an HttpOnly cookie scoped to /play; only its SHA-256 is
  stored, because seat ids are visible to everyone at the table), pick a character from the cast, then see the
  current slide from the snapshot. Media comes from
  `/play/[code]/media/[kind]/[name]`, which serves only files the snapshot
  uses, and only to a seated player.
- **Realtime.** Changes publish on an in-process bus
  (`lib/table-events.ts`, one event per table id) and stream out as
  server-sent events: players on `/play/[code]/events`, the TL on
  `/campaigns/[id]/table-events`. Writers publish; streams re-read and
  push. In-process fits one server; more than one needs a shared bus
  (Redis pub/sub, Postgres LISTEN) behind `publishTable` /
  `subscribeTable`. `/play/[code]/state` returns the same state once.
- **Chat.** Players and the TL, in `table_messages`; a floating button on
  the player side, a panel in Present.

### How a change reaches every screen

No machine talks to another. Every browser talks only to the server,
and the server's SQLite row for the table is the one true state
(current slide, playback, live state, seats, responses, chat).

- **Up: server actions.** The TL's screen and every player's screen
  change the table only through POST-only server actions
  (`app/campaigns/[id]/table-actions.ts`, `app/play/[code]/actions.ts`).
  Each checks who is calling (owner, or a seated player at this table),
  writes, then calls `publishTable(tableId)`.
- **The bus.** `lib/table-events.ts` is a Node `EventEmitter` with one
  event name per table id. `publishTable` carries no payload: it only
  says "this table changed".
- **Down: server-sent events.** Each screen holds one long-lived GET
  open. On every publish the stream re-reads state *for that viewer* and
  pushes a whole snapshot, never a diff. Players stream
  `/play/[code]/events` and get `playerView` (slide, playback as of
  now, timer, `shown`, the activity's data filtered for their seat). The
  TL streams `/campaigns/[id]/table-events` and gets the seats and the
  unfiltered activity view. Chat is its own stream per side: history
  once, then one event per message. A 15s keep-alive comment holds
  proxies open; a failed read ends the stream so the browser reconnects.
- **Player to player is player, server, everyone.** A vote: the player's
  `activityAction` runs the activity's `player.answer` handler, which
  writes a `table_responses` row and publishes. Every stream for that
  table re-reads: the TL's count ticks up; other players see the result
  only once `shown` is set, because `view` decides per seat at read time.
- **Content is pulled, not pushed.** The feed carries `snapshotAt`; when
  it changes the player fetches `/play/[code]/snapshot` once. Media is
  fetched by URL as the slide needs it.
- **One process.** The bus is in-memory. More than one server needs a
  shared bus (Redis pub/sub, Postgres LISTEN) behind `publishTable` /
  `subscribeTable`, and SQLite wants a single writer too. See
  [deploying.md](deploying.md) for the one-container shape this implies.

### Video and sound

Media files are never streamed through the feed. They are ordinary HTTP
files, and only *control* travels over the feed.

- **Serving.** Players load media from
  `/play/[code]/media/[kind]/[name]`, which serves a file only if the
  table's snapshot references it and the caller holds a seat, so a seat
  can't browse the campaign's folder. `lib/serve-file.ts` streams from
  disk with `Range` support (seeking, and browsers fetch video in
  chunks), `nosniff`, and a long immutable cache because names are
  random and never reused. The TL loads the same files from the owner-only
  campaign routes.
- **Video follows the TL** (`slide-video.tsx`). The TL's `<video>` is the
  lead: every play, pause and seek calls `setPlaybackAction`, which stores
  `{ slide, playing, position, at }` with `at` from the server clock. The
  feed sends players `playbackNow`: position plus the time elapsed on the
  server since `at`, so client clocks never matter. A player's copy takes
  no input. On every feed update and `timeupdate` it computes the target
  from the last update and the time since it arrived, then corrects:
  within 0.3s do nothing; up to 2s off, play at 1.08x or 0.92x until
  caught up; beyond 2s, seek. It never seeks while buffering, since
  seeking on small drift was what caused stutter. If autoplay is blocked,
  one "Tap to play" button shows. The next three slides' videos preload
  hidden so a video slide starts at once.
- **Music and effects are local** (`soundtrack.tsx`). Both sides run the
  same component against the same slide list, so they stay in step by
  following the current slide, not by syncing audio. The music on a slide
  is the nearest earlier slide's track (or stop); it loops, fades in over
  900ms and out over 450ms, and ducks to silence on a video slide. An
  effect plays once per arrival on its slide. Nothing is synchronised
  tighter than the slide change itself.
- **The sound gate.** Browsers refuse audio until the page has been
  tapped. A player's first screen is the sound panel (`app/play/sound.tsx`):
  video, music and effects levels plus mute, kept in localStorage per
  browser, and the tap itself unlocks playback (it also resumes a Web
  Audio context). Players set their own levels; the TL's volume is not
  broadcast. If the browser still refuses later (after a refresh), the
  soundtrack retries on the next tap or key.

### Activities at the table

`lib/activity-runtime.ts` is where the registry meets a live table. For
the activity on the slide the TL is on, the framework owns its timer
(`live_state.timers`, started the first time the slide comes up), whether
its results are `shown` (`live_state.shown`), its per-slide JSON state
(`live_state.activities[slide]`) and its per-seat responses
(`table_responses` rows). Everything else is the activity's own, behind
its server entry: `view` builds what each viewer's feed carries, and the
two generic server actions (`activityAction` for players,
`leadActivityAction` for the TL) dispatch to its named handlers after
checking the caller and that the slide is the one on screen. See
docs/adding-an-activity.md.

## Conventions

- **Desktop only.** No mobile media queries unless asked.
- **Reduced motion.** Every animated surface gets a
  `@media (prefers-reduced-motion: reduce)` block.
- **Comments explain why, not what.** Doc comments at the top of files and
  on non-obvious code; no narrating comments.
- **Lean assets.** WebP for images, web-encoded mono MP3 for audio, no
  base64 bitmaps inside SVGs, never `preload="auto"` on large audio.
- **No emojis** in the UI.
- **Commits:** lowercase scope in parens, one-line summary, body that
  explains why. Branch per feature, merge with `--no-ff`.
