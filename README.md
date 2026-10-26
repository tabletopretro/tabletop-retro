# Tabletop Retro

A framework for running team retrospectives as a one-shot tabletop
campaign. A **Table Lead** writes a campaign (chapters of pages: story,
speaking lines, activities) and presents it at a table; players join from
their own devices with a table code and take part in the activities as
the slides come up.

It ships with three activities (Q&A, Vote, D20 Dice Roll) and a registry
for adding your own. The bones are meant to be built on: fork it, write
your campaign, add the games your team would play.

## Run it

Requires Node 24 (`.nvmrc`).

```bash
nvm use
npm install
npm run db:push   # creates dev.db from db/schema.ts
npm run db:seed   # four local users and an example campaign
npm run dev       # http://localhost:1313
```

Sign in as **Ada** (dev builds only; there are no passwords), open the
**Example retro** campaign, press **Present**, then **Open table
for players**. Open `http://localhost:1313` in another browser and join
with the code shown in the header.

Local sign-in exists only under `npm run dev`. A production build has no
working sign-in until you wire an identity provider (see
[Deploying](#deploying)).

`npm run dev:lan` binds to your network so phones can join, which also
means anyone on that network can sign in as anyone. Dev only.

## Working with an AI agent

Open the folder in an agent that reads `AGENTS.md` (Claude Code, Cursor,
Codex and the like). It will ask whether you want a step-by-step tour of
the components or to jump straight into writing a story, and guide you
from there. `docs/` is written for people and agents alike.

## What's in a retro

| Word | Means |
| ---- | ----- |
| Campaign | What a Table Lead writes: chapters of pages, a cast, art, soundtrack |
| Chapter | An ordered group of pages, with an optional opener (title slide) |
| Page | One screen the table sees: a story page, a speaking line, or an activity |
| Activity | What an activity page runs, from the registry: Q&A, Vote, Dice, or yours |
| Character | A role in the story, from the Table Lead's library; a player *plays* one |
| Table | One sitting of a campaign: opened by the Table Lead, joined with a code |

The Table Lead presents from `/campaigns/[id]` (edit and present modes
share one editor); players sit at `/play/[code]`. Everything at the table
is live: slides, video, answers, dice rolls, chat.

## Writing a campaign

A few things the editor doesn't spell out:

- **Music carries across slides.** A track set on a page keeps playing on
  every page after it until a page sets another track or a stop. It
  loops: when it reaches its end it restarts at once, with no fade, so a
  track meant to run under several slides should be cut to loop cleanly
  or be long enough that the seam rarely comes. Music ducks to silence on
  a video slide and comes back after.
- **Each player's music runs on their own clock.** The slide change is
  what keeps screens in step, not the audio, so players who joined at
  different moments are at different points in the track. Ambient beds
  work; anything with a strong beat or a verse structure will be audibly
  out of step between devices.
- **Effects play once**, when their page comes up.
- **Players set their own volume.** The sound panel they see on arrival
  (video, music, effects, mute) is per device; your levels in Present are
  not sent to them.
- **Video follows you.** Your play, pause and seek reach every player's
  copy; theirs take no input. Each video page plays either when the
  slide shows or when you press play, set per page.
- **Headings can fade in**, letter by letter or whole, over a few
  seconds ("Fade in" under the heading).
- **An empty page is blank for players.** The "nothing on this page
  yet" note is yours only.
- **Players see less than you do.** Page names, chapter titles, speaker
  notes, opener notes, and characters' notes, portraits, artwork and
  custom fields never leave your screen. Players get each character's
  name only.
- **But not less than the slides.** Players' devices get the whole
  campaign's slides when the table opens, so a curious player who
  reads the page's data can see what's coming. Don't put a surprise on
  a slide that the room mustn't know about in advance.
- **Chapters close deliberately.** Forward keys stop at a chapter's last
  slide; moving on takes a click on "Close Chapter N" or Shift+→. Going
  back into a closed chapter asks first. The deck isn't stuck.
- **Undo is 50 steps** of the whole campaign, and lasts as long as the
  tab. Character edits (name, notes, portrait, fields) save to your
  library at once and aren't undoable, because every campaign that casts
  the character shows them.
- **Media limits:** images 5 MB, video 100 MB (MP4, WebM, MOV), sound
  20 MB, each typed from the file's first bytes, not its name. Files
  nothing references are pruned ten minutes after a save, unless undo
  can still reach them.

## Running a table

- **Edits go live on save.** While the table is open, every autosave
  (800ms after you stop typing) refreshes what players see. A typo fix
  reaches them without reopening; so does a change you were only
  trying out.
- **Timers start the first time a slide comes up** at an open table, not
  each time you arrive. Going back to a timed activity finds its timer
  run out, and input locks 1.5 seconds after it ends. "Restart timer" in
  Table controls starts it again.
- **Anonymous hides names from you too.** On an anonymous Q&A or vote
  nobody, the Table Lead included, sees who answered what, and answers
  come in a fixed shuffled order. There's no way to see it afterwards.
- **One code per campaign, for good.** It's claimed the first time you
  open a table and reused every time after. "New code" in Settings
  retires it (not while the table is open); anyone who saved the old
  code loses it.
- **Anyone with the code can join at any point** while the table is
  open. Locking the table once the story starts, with late players let
  in by you, is planned.
- **Guests are a browser cookie.** A player who isn't signed in sits by
  name, kept in a cookie. A new browser or cleared cookies means a new
  seat; the old one stays in "At the table" until you remove it.
- **One player per character.** Picking a character someone else holds
  is refused; you can release it from "At the table".
- **Everyone sees every roll.** The die lands on the same face on every
  screen, and a late arrival sees the last result. A player handed the
  dice rolls from their own device.
- **Chat** messages are capped at 500 characters, and players see recent
  history only.
- **Closing is final.** The code stops working; answers, votes, rolls
  and chat stay in the database, but nothing in the app shows them
  again. Opening the campaign again starts a new, empty table. There is
  no transcript export yet.
- **A campaign you've run can't be deleted** from the app: deleting is
  refused once any table has used it, because tables keep the history.
  Removing it means deleting its tables in the database first.

## Adding an activity

An activity is one folder under `activities/` with a definition (data,
parsing, four React screens) and a server entry (what the feed sends,
what players and the Table Lead can do). Register it in
`activities/index.ts` and `activities/server.ts` and nothing else in the
app needs to change.

Read [docs/adding-an-activity.md](docs/adding-an-activity.md). For a
game with more than one beat, it recommends a shape that runs well at a
table: a title slide, a Start button, Table Lead controls for each stage,
then a summary everyone sees ("Shaping a game"). The three
built-ins are the worked examples: `activities/qa` (per-seat text),
`activities/vote` (one choice per seat), `activities/dice` (a game with a
setting and live shared state).

## Layout

```
activities/   the activity registry and the built-in activities
app/          Next.js App Router: library, campaign editor, play, sign-in
lib/          campaign document, tables, auth, activity runtime
db/           Drizzle schema, seed
content/      campaigns authored locally (git-ignored; pairs with dev.db)
docs/         architecture, design rules, adding an activity, deploying
```

[docs/architecture.md](docs/architecture.md) covers the stack, auth,
tables and realtime, the campaign document, media and conventions.
[docs/design.md](docs/design.md) has the theme tokens and the design
rules the UI follows.

## Deploying

Tabletop Retro is self-hosted: one organisation runs it for its own
teams. The recommended shape is **one app container** (exactly one
replica) with **one persistent volume** holding the SQLite database and
the campaign files, behind a reverse proxy that terminates HTTPS:

| Setting | Default | In a container |
| ------- | ------- | -------------- |
| `DATABASE_PATH` | `dev.db` | `/data/tabletop.db` |
| `CONTENT_DIR` | `./content` | `/data/content` |

Live tables run on an in-process bus and SQLite wants one writer on a
local disk, so it doesn't scale out: deploy with stop-then-start, not a
rolling update, and use a block volume, not a network file share. The
proxy must pass the host through, not buffer server-sent events, and
accept 100 MB uploads.

[docs/deploying.md](docs/deploying.md) covers why, storage, upgrades
and schema changes, proxy settings (Caddy and nginx), backups, and a
starting Dockerfile and compose file.

Two things to do before it faces the internet:

- **Sign-in.** Production has none until you wire an identity provider;
  the dev-only local sign-in is off outside `next dev` and there is
  deliberately no flag to turn it on. See "Auth" in
  docs/architecture.md for where SSO plugs in.
- **Abuse limits are per process.** Joining and taking a seat are
  rate-limited by client address in memory, each table seats at most 50,
  and each account's uploads share a storage budget (`STORAGE_PER_OWNER_MB`,
  default 2048). Run one instance, or move the limiter to a shared store.

## License

MIT. See [LICENSE](LICENSE).
