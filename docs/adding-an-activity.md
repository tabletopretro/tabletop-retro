# Adding an activity

An activity is what an activity page runs at the table. Each one is a
folder under `activities/` and the rest of the app never names it: the
editor, the stage, players' screens, the table controls, the feed and the
two server actions all go through the registry.

The three built-ins are the worked examples. Read them in this order:

- `activities/qa`: a question, per-seat text answers in the responses
  store, results the Table Lead reveals. The simplest shape.
- `activities/vote`: the same with one choice per seat and a settings-free
  editor with an option list.
- `activities/dice`: a game. No question, a setting (the dice's look),
  live shared state kept with the table, and controls that also work
  while rehearsing with no table open.

## The pieces

```
activities/
  index.ts        ← register the definition here (catalog order)
  server.ts       ← register the server entry here
  types.ts        ← the contract: ActivityDefinition, ActivityServer, props
  kit/            ← helpers you can build on (timer, question frame, editor controls)
  your-thing/
    definition.ts   id, name, blurb, icon, make, parse, flags, the four screens
    editor.tsx      Editor:   what the Table Lead writes on the page
    stage.tsx       Stage:    the slide on the Table Lead's screen (and as a thumbnail)
    play.tsx        Play:     the slide on a player's device
    controls.tsx    Controls: what you add to the "Table controls" panel (optional)
    server.ts       what the feed sends, and what players / the Table Lead can do
```

### 1. The config: what's stored in the campaign file

Every activity's config starts with `{ type, timer, settings }`
(`ActivityConfig` in `types.ts`). `type` is your id and it is stored in
campaign files forever: lowercase letters, digits and dashes, never
renamed or reused. Add your own fields on top:

```ts
export type ScaleConfig = ActivityConfig & {
  type: "scale";
  prompt: string;
  low: string;   // what 1 means
  high: string;  // what 5 means
};
```

`make()` returns your fields for a new page; `parse(raw)` turns whatever
is on disk into them, or returns `null` when it's malformed. Never trust
the shape, and give older files defaults so they still open. The
framework parses `type`, `timer` (if `timed`) and `settings` (if you
declare any) itself.

### 2. The definition

```ts
export const scale = defineActivity<ScaleConfig, ScaleData>({
  id: "scale",
  name: "Scale",
  blurb: "You ask; each player answers from 1 to 5.",
  Icon: ScaleIcon,
  timed: true,
  reveal: { done: "answered", show: "Show answers", hide: "Hide answers", none: "collect answers" },
  make: () => ({ prompt: "", low: "Not at all", high: "Completely" }),
  parse: (raw) => { /* check each field, return null if bad */ },
  hasContent: (config) => config.prompt.trim() !== "",
  summary: (config) => config.prompt.trim() || null,
  empty: (config) => (config.prompt ? null : "No question written yet."),
  Editor: ScaleEditor,
  Stage: ScaleStage,
  Play: ScalePlay,
  Controls: ScaleControls,
});
```

The flags and hooks, all in `types.ts`:

- `timed`: the Table Lead can set a countdown; it starts the first time
  the page comes up at an open table and the feed carries the time left.
  `activities/kit/timer.tsx` has `Countdown`, `useOpen` and `useRun`.
- `settings`: pickers the framework renders under your editor and stores
  on `config.settings` by key, with defaults filled in and unknown
  values dropped (`resolveSettings`). The dice's look is one.
- `reveal`: words for the framework's results header in the table
  controls (how many have taken part, the Show/Hide button that sets
  `shown` on the feed). Leave it out when there's nothing to reveal.
- `bleed`: the slide fills edge to edge; you draw your own frame.
- `hasContent`, `summary`, `images`, `empty`: whether clearing asks
  first, the page label's subtitle, images to keep from being pruned,
  and the note the Table Lead sees when there's nothing to show yet.

### 3. The four screens

Each gets `config` and `pageId`, and the props in `types.ts`:

- **Editor** (`EditorProps`): call `onType(next)` while typing (one undo
  step) and `onEdit(next)` for picks, adds and removes (their own step).
  `activities/kit/editor.tsx` has `PromptField`, `OptionList`, `Segmented`,
  `CheckOption`, `Setting`, `Rules`, `Preview`.
- **Stage** (`StageProps`): the Table Lead's slide. `live` is false in
  thumbnails: render a still and mount nothing heavy. `feed` and `table`
  are null while rehearsing (no table open) and in thumbnails; `local` is
  per-slide state you can keep on the Table Lead's screen meanwhile.
- **Play** (`PlayProps`): a player's slide. `act(action, payload)` runs
  one of your server `player` handlers on the current slide and resolves
  with `{ ok }` or `{ ok: false, error }`.
- **Controls** (`ControlsProps`): what you add to the table controls
  panel, under the framework's results header if you declared `reveal`.
  `table.lead(action, payload)` runs one of your `lead` handlers.

`names.nameOf(seatId)` names a seat; `names.subjects` are the people at
the table shaped like characters (portraits, names), or the cast when
rehearsing. Put nothing on a player's screen that they shouldn't see:
the feed decides what each viewer gets (next section).

### 4. The server entry

```ts
export const scaleServer = defineActivityServer<ScaleConfig, ScaleData>({
  view: (ctx, seatId, shown) => ({ answered, data }),
  player: { answer: (ctx, seatId, payload) => { /* ... */ return { ok: true }; } },
  lead: { /* optional */ },
});
```

`view` runs for every viewer on every change: the Table Lead (`seatId`
null) sees everything; a player sees their own input, and everyone's
once `shown`. What it returns goes out as `feed.data`; `answered` feeds
the "3 of 5 answered" count.

`ctx` (`ServerContext`) gives you:

- `ctx.store`: per-seat rows for this slide (`rows`, `insert`, `update`,
  `remove`, `transaction`), each with a text `answer` and a numeric
  `choice`. Enough for answers, votes, scores and times.
- `ctx.state()` / `ctx.setState(next)`: your own JSON state for this
  slide, kept with the table and pushed to every screen on change. The
  dice keep their turn here.
- `ctx.locked`: the timer has run out (with a moment's grace).
- `ctx.seats`: who's at the table, to validate ids against.
- `ctx.config`, `ctx.slide`, `ctx.tableId`, `ctx.publish()`.

Payloads are untrusted: check every field. The framework has already
checked the caller (a seated player, or the campaign's owner) and that
the slide is the one on screen.

### 5. Register it

```ts
// activities/index.ts
export const ACTIVITIES = [qa, vote, dice, scale];
// activities/server.ts
export const ACTIVITY_SERVERS = { qa: qaServer, vote: voteServer, dice: diceServer, scale: scaleServer };
```

That's the whole change outside your folder. The catalog (the editor's
picker and the library's Activities tab), page labels, the stage, the
player view, the controls panel and the feed pick it up.

## Shaping a game: title, start, stages, summary

Q&A and Vote are one beat long: the question is up, people answer, the
Table Lead reveals. A game usually needs more, and it runs best at a
table when every game has the same four beats:

1. **Title.** The slide comes up showing the game's name and one line of
   rules. Nothing happens yet; players' screens show the same title
   with "Waiting for the Table Lead". This gives the Table Lead time to
   explain the game while everyone's still looking at the room.
2. **Start.** One button in the Table controls starts it. Never start a
   game when its slide comes up: the Table Lead may land on it by
   mistake, or step back to it later.
3. **Stages.** The game itself, in named stages (a round, a reveal, a
   vote on the result). The Table Lead moves it on; the controls show
   only what makes sense at the current stage, with the next step as
   the obvious button.
4. **Summary.** An ending everyone sees: the results, who did what (unless
   the game is anonymous), and a line the Table Lead can talk to. "Play
   again" goes back to the title.

### The stage machine

Keep the stage in the activity's live state (`ctx.state`), so every
screen moves together and a player who arrives late lands on the right
stage. Write the moves as pure functions in their own file, shared by
the server and the controls, the way `activities/dice/turns.ts` is:

```ts
// activities/scale/stages.ts
export type Stage = "title" | "answering" | "revealed" | "summary";
export type ScaleState = { stage: Stage; round: number };

export const START: ScaleState = { stage: "title", round: 0 };

/** What each stage may move to. Anything else is refused. */
const NEXT: Record<Stage, Stage[]> = {
  title: ["answering"],
  answering: ["revealed"],
  revealed: ["answering", "summary"],
  summary: ["title"],
};

export function move(state: ScaleState, to: Stage): ScaleState | null {
  if (!NEXT[state.stage].includes(to)) return null;
  if (to === "title") return START;
  return { stage: to, round: to === "answering" ? state.round + 1 : state.round };
}
```

The server's `lead` handlers are the only way a stage changes, and each
one checks the move is allowed from where the game is now. A double
click, two tabs or a crafted request can't skip a stage:

```ts
// activities/scale/server.ts
const stateOf = (ctx: ServerContext<ScaleConfig>) => ctx.state<ScaleState>() ?? START;

export const scaleServer = defineActivityServer<ScaleConfig, ScaleData>({
  view: (ctx, seatId) => {
    const state = stateOf(ctx);
    const rows = ctx.store.rows().filter((r) => r.choice !== null);
    const mine = seatId ? rows.find((r) => r.seatId === seatId) : null;
    // Players see everyone's answers only once revealed.
    const open = seatId === null || state.stage === "revealed" || state.stage === "summary";
    return { answered: rows.length, data: { state, mine: mine?.choice ?? null, all: open ? rows.map((r) => r.choice) : null } };
  },
  lead: {
    move: (ctx, raw) => {
      const to = (raw as { to?: unknown } | null)?.to;
      const next = typeof to === "string" ? move(stateOf(ctx), to as Stage) : null;
      if (!next) return { ok: false, error: "Not from here" };
      if (next.stage === "title") ctx.store.transaction(() => ctx.store.rows().forEach((r) => ctx.store.remove(r.id)));
      ctx.setState(next);
      return { ok: true };
    },
  },
  player: {
    answer: (ctx, seatId, raw) => {
      if (stateOf(ctx).stage !== "answering") return { ok: false, error: "Not now" };
      // ...check the payload, then insert or update this seat's row
      return { ok: true };
    },
  },
});
```

Check the stage in every `player` handler too: input sent during the
title or the summary is refused, not stored.

### One component per beat

Stage, Play and Controls each switch on the stage, and each beat is its
own small component. That keeps the four screens in step and makes a
missing case obvious:

```tsx
export function ScaleStage({ config, live, feed, table, local }: StageProps<ScaleConfig, ScaleData>) {
  if (!live) return <ScaleIcon size={64} />;
  const { state } = scaleLink(feed, table, local);
  switch (state.stage) {
    case "title":     return <Title name="Scale" rule={config.prompt} />;
    case "answering": return <Answering config={config} feed={feed} />;
    case "revealed":  return <Spread config={config} feed={feed} />;
    case "summary":   return <Summary config={config} feed={feed} />;
  }
}
```

What each screen shows, beat by beat:

| Beat | Stage (the room) | Play (each player) | Controls (Table Lead only) |
| ---- | ---------------- | ------------------ | -------------------------- |
| Title | Name, one-line rule | Same title, "Waiting for the Table Lead" | **Start** |
| Stages | The shared view of the stage | Their own input, then their own result | The next step (**Reveal**, **Next round**), plus **End game** |
| Summary | Results and a line to talk to | The same results | **Play again** |

The Stage is the screen the room watches, so it shows nothing private.
What a player sees comes from `view`, so decide there what each seat may
see at each stage, not in the Play component.

### Rehearsing

With no table open, `table` is null and there's no server, but the
Table Lead still wants to click through the beats. Keep the stage in
`local` then, and run the same `move` there. One helper gives every
screen the same answer, like `activities/dice/turn-link.ts`:

```ts
export function scaleLink(feed: LiveActivity<ScaleData> | null, table: TableLink | null, local: LocalState) {
  const state = table ? (feed?.data.state ?? START) : ((local.value as ScaleState | null) ?? START);
  return {
    state,
    move: (to: Stage) => {
      if (table) table.lead("move", { to }).catch(() => undefined);
      else {
        const next = move(state, to);
        if (next) local.set(next);
      }
    },
  };
}
```

### Things to get right

- **The framework's timer is per slide**, and starts when the slide
  first comes up, which in a staged game is the title. Leave `timed`
  off and keep a stage's deadline in your own state (`endsAt`, server
  time) when a round needs a countdown; `activities/kit/timer.tsx` can
  still draw it.
- **Rounds keep their history.** If the summary needs every round, store
  each answer with its round (in `answer` as JSON, or keep a tally in
  state) instead of overwriting.
- **Late arrivals** get the current stage from the feed with nothing
  extra to do. Make sure each stage's Play screen makes sense to someone
  who missed the stages before it.
- **Going back** to a finished game's slide shows its summary, because
  the state stays with the table. "Play again" is how to run it twice.
- **Keep the title short.** One line of rules on the slide; anything
  longer goes in the editor's `Rules` for the Table Lead to say aloud.

## Retiring an activity

Remove it from both registries and delete the folder. Pages that used it
still load: the parser keeps an unknown type as is, the editor says the
activity isn't available in this version, and the stage shows the Table
Lead a note. Don't reuse the id.

## Styling

Activities style themselves (CSS modules beside the components) with
the theme tokens in `app/globals.css` (`--bg`, `--fg`, `--fg-muted`,
`--border`, `--accent`, `--accent-2`, `--font-title`, `--font-body`),
never raw colors, so they follow the palette. See docs/design.md for the
rules the rest of the UI keeps to; `activities/kit/asked.module.css` and
`activities/kit/editor.module.css` are the shared starting points.
