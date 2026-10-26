# Theme and design rules

`app/globals.css` defines semantic tokens (`--bg`, `--surface`, `--fg`,
`--fg-muted`, `--fg-subtle`, `--border`, `--accent`, `--accent-2`,
`--accent-touch`, `--font-title` / `--font-body`), dark by default with a
light set. Stylesheets only reference tokens, never raw colors. If a
theme is ever applied per campaign, it overrides tokens on table surfaces
only; home, sign-in and the library stay neutral, with no genre words in
shell copy or token names.

- **Fonts:** IBM Plex Sans for titles (600), Manrope for body.
- **Flat.** No shadows, and square by default; `--radius-*` are 0.
  Rounding is the exception, explicit and commented where it's set: edit
  fields (4px) and soft buttons and their menus (6px).
- **Few borders.** Separate things with space, type size and weight
  first; reach for a border only for real structure (the app header,
  panels, the slide frame) or an input field.
- **Soft buttons.** Session and settings actions (Present, Table, Open
  table for players, New code, Delete campaign) are a faint `--fg` wash
  with a 6px radius and no border; hover deepens the wash (or turns red
  for destructive ones); disabled is a lighter wash with subtle text,
  using `aria-disabled` so a tooltip can say why.
- **Edit fields vs input fields.** An *edit field* is text that becomes
  editable in place (chapter titles, page renames, a character's name):
  no border, a faint wash, a 4px radius. An *input field* is a form
  control that's always a field (the code field, body text, notes, vote
  options): flat and square with a border.
- **No large grey fills.** Panels and frames are bordered, not filled;
  grey backgrounds are for small states only (a selected row, a hover).
- **Monochrome, by decision.** The shipped theme has no accent hue:
  `--accent` is the foreground color, `--accent-2` is `--fg-subtle` and
  `--accent-touch` is `--accent`. Interaction is shown with washes,
  borders and weight, not color. Keep it that way in the core.
- **Two accents, fixed jobs.** If a fork wants color, the recommended
  scheme is two hues with fixed meanings, set once in `app/globals.css`
  (both the dark `:root` set and the light one): `--accent` means "you
  can interact with this" (primary actions, focus, hover confirmation,
  drop targets); `--accent-2` marks structure that isn't clickable (page
  and chapter numbers, eyebrows). Neither is ever decoration. Set
  `--accent-touch` to a softer version of `--accent` for small touches
  (caret, selection, the selected page's bar, quiet hovers) when the
  full hue is too loud at that scale; `--accent-fg` is the text color on
  an `--accent` fill. Every stylesheet already reads these tokens, so no
  rule needs to change; check contrast on buttons and the slide frame.
- **No side stripes.** No coloured bar down one edge of a card, quote,
  list or tooltip. Use type, spacing or a full border instead.
- **No redundant rules.** Don't add a horizontal line where whitespace or
  a change in text size already separates things.
- **Less text on the page.** Labels and one-line hints only; anything
  explanatory goes in a tooltip.
- **No declaring subtext.** Don't caption things to announce what they
  are or do ("Click to copy", "Optional"). A standard affordance says it:
  a copy icon beside the code, a pencil for rename, a trash can for
  delete. If it still needs words, that's a tooltip.
- **Tooltips, never `title`.** Use `Tooltip` (`app/tooltip.tsx`) for every
  hint, with `side` set so it stays on screen. "Only you see this" is
  `PrivateHint` (`app/private-hint.tsx`).
- **Deleting.** Undoable deletes (pages, cast members) happen at once,
  with "⌘Z brings it back" in their tooltip. Final ones sit apart and
  confirm with a dialog (`confirm-dialog.tsx`) that lists what they affect.
- **Counts must survive an adversarial read.** Add a count only if you
  can answer "what does the reader do differently because of this
  number?"
- **Activities style themselves** with the same tokens; the shared
  starting points are `activities/kit/asked.module.css` (a question with
  things under it) and `activities/kit/editor.module.css` (editor
  controls).
