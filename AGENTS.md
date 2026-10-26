<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Tabletop Retro — agent handoff

A framework for running team retrospectives as a one-shot tabletop
campaign. A **Table Lead (TL)** writes a campaign and presents it at a
table; players join with a code and take part from their own devices.

Read before changing anything:

- `README.md`: what it is, how to run it, the layout.
- `docs/architecture.md`: stack, auth (fails closed; read this before
  touching sign-in), vocabulary, the campaign document, the editor,
  tables and realtime, conventions.
- `docs/adding-an-activity.md`: the activity registry. Activities are the
  extension point; the core never names one.
- `docs/design.md`: theme tokens and the design rules every screen keeps.

## Boot it locally

```bash
nvm use           # Node 24 (see .nvmrc)
npm install
npm run db:push   # sync db/schema.ts into dev.db (again after any schema change)
npm run db:seed   # local users and the example campaign
npm run dev       # → http://localhost:1313
```

Run the dev server in the user's own terminal, not yours: backgrounded
agent processes die when the agent shell ends. `npm run typecheck` and
`npm run lint` are the checks to run before handing work back.

## Helping someone get started

When a person opens this repo with you and hasn't said what they want,
ask one question before doing anything else:

> Do you want a step-by-step breakdown of how to build the individual
> components, or do you want to jump right in and build a story?

Then follow the path they pick. Both need the app running (Boot it
locally, above); if it isn't, walk them through that first, in their
terminal. These paths are a starting point and will grow with the
framework; add to them rather than inventing a parallel flow.

### Path 1: the components, step by step

Walk the pieces in this order, one at a time. For each: read its files,
explain in a few sentences what it does and the rule it keeps, point at
the doc section that covers it, and offer one small hands-on change
they could make to see it move. Pause after each piece and ask whether
to go deeper or move on.

1. **The campaign document.** `lib/campaign-doc.ts` (types, limits,
   `parseCampaignDoc`) and a real file under
   `content/campaigns/<folder>/campaign.json`. `db/seed.mjs` writes a
   complete one.
2. **The editor.** `app/campaigns/[id]/campaign-editor.tsx` and
   `page-editor.tsx`: outline, page kinds, autosave, undo through `commit`.
3. **Present mode.** `present-view.tsx` and `player-screen.tsx` (the
   screen players see, shared with the player side), chapter edges,
   the filmstrip.
4. **Tables and players.** `lib/tables.ts` (open, snapshot, live state),
   `app/play/[code]/`, and the server-sent event streams in
   `app/play/[code]/events/route.ts` and
   `app/campaigns/[id]/table-events/route.ts`.
5. **Activities.** `activities/types.ts`, one shipped activity folder
   (`activities/vote/` is the smallest complete one), then
   `docs/adding-an-activity.md`.
6. **Characters.** `lib/characters.ts`, `app/characters/`, the cast in
   the campaign JSON.
7. **Auth.** `lib/auth/`. Explain why it fails closed and what SSO would
   have to do; suggest no changes here.

Finish by offering Path 2.

### Path 2: jump in and build a story

1. **Ask about the retro** before writing anything: the team, the
   period it covers, what happened (the good and the bad), the tone they
   want, how long the session is, how many players, and whether answers
   should be anonymous.
2. **Outline first.** Propose chapters and pages in chat as a short
   list (story beats, Q&As, votes, a dice roll where a decision is
   needed) and get agreement before writing the file.
3. **Write it as a campaign.** The shape is `CampaignDoc` in
   `lib/campaign-doc.ts`; `db/seed.mjs` is a complete worked example to
   copy from (ids are ten `[a-z0-9]` characters; shipped activity types
   are `qa`, `vote` and `dice`). Two ways in:
   - Have them press **New campaign** in the library, then close that
     editor tab. Find the row's `content_path` in `dev.db` (the
     `campaigns` table) and write the pages into that folder's
     `campaign.json`. The editor autosaves whatever it has, so never
     edit the file while the campaign is open in a browser.
   - Or write a seed-style script that inserts the campaign row and the
     file together, like `db/seed.mjs` does.
   Run the result through `parseCampaignDoc` (a one-line script) before
   telling them it's ready.
4. **Check it at the table.** Have them open the campaign, read each
   page and its speaker notes, press **Present**, then **Open table for
   players** and join from a second browser with the code. Fix what
   reads badly.
5. **Build in passes.** Skeleton and text first; then activities and
   their prompts; then characters, images, video and sound, which they
   add in the editor. When they add music, tell them it loops and carries
   across slides until another track or a stop, and that each player's
   copy runs on its own clock (README, "Writing a campaign"). If the
   story needs a game the catalog doesn't have, that's
   `docs/adding-an-activity.md`.

### On either path

- Use the vocabulary below and in docs/architecture.md; say Table Lead,
  never DM.
- Deleting a campaign or a character isn't undoable: ask first.
- Keep what the person sees short. Explain in chat; put only the words
  the UI needs on the page.

## Rules that are easy to break


- Use the vocabulary in docs/architecture.md everywhere: UI, identifiers,
  routes, docs. TL is "Table Lead", never DM.
- Every export in a `"use server"` file is a public endpoint: re-check the
  session and ownership in each one, and treat ids and payloads as
  hostile. Activity handlers get an already-checked caller but still own
  their payloads.
- An activity id (`type`) is stored in campaign files forever. Never
  rename or reuse one; retire by removing it from the registries.
- New fields in the campaign document need a default in the parser so
  older files still open (`lib/campaign-doc.ts`, and `parse` in an
  activity's definition).
- Anything that holds an image must be counted as referenced
  (`docImages`, or `images()` on an activity), or a save will prune it.
- Stylesheets reference tokens only, never raw colors. No shadows, square
  by default, no side stripes, no declaring subtext, tooltips never
  `title`. See docs/design.md.
- No manual memoization (the React Compiler is on). Page changes animate
  with `<ViewTransition>`; typing never animates.
- Desktop only. Every animated surface gets a reduced-motion block.
- No emojis in the UI. Comments explain why, not what.
- Commits: lowercase scope in parens, one-line summary, a body that says
  why. Don't push without asking.
