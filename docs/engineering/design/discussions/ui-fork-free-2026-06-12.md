# UI Fork — Free Direction: "Paste-Up" (拼版室)

- Date: 2026-06-12
- Branch: `ui-fork/free`
- Status: design manifesto written **before** reading any existing style code (concept independence guarantee). Functional code (routes, data flow, contracts) was treated as ground truth; visual code was not consulted.

## 1. The design language, named

**Paste-Up** — after the pre-digital print production room, where layout artists
physically pasted galleys of type and photo blocks onto gridded boards, drew
their instrument marks in *non-photo blue* (a light cyan the process camera
could not see), and stamped the job ticket when a board went to press.

This is not a nostalgic skin. It is chosen because the metaphor is *structurally
isomorphic* to what SHCKB actually is:

| SHCKB fact | Paste-up fact |
| --- | --- |
| Blocks freely placed on a 12-column grid | Galleys pasted on a gridded board |
| Optional gravity (float-up alignment) | Squaring galleys to the column tops |
| Themes own the content surface; chrome does not | The camera shoots the board, never the room |
| Editor instrumentation invisible to readers | Non-photo blue marks vanish in print |
| Two-state publish (working copy / public edition) | Board on the bench vs. edition on the press |
| Single author, anonymous readers | One paste-up artist, many newsstand readers |

## 2. Core tenets

1. **The room serves the board.** Editor chrome is a workbench: one fixed,
   neutral palette — bone paper (`#F4F1EA` family) and graphite ink (`#1C1B18`
   family) — that never changes with the content theme. The themed canvas sits
   on the bench like a sheet on a light table, visibly *a sheet*: it has an
   edge, a margin, a shadowless lift. Chrome must look correct next to *any*
   theme because it refuses to compete with all of them.

2. **Instrument marks are non-photo blue.** Everything that exists only for the
   author — grid hints, selection handles, drag ghosts, drop targets, resize
   affordances — renders in a single non-photo blue (`#5BA8C4` / lighter washes).
   The rule is legible: *if it's blue, the reader will never see it.* This gives
   the editor a quiet two-channel vocabulary: ink = content & chrome,
   blue = instrumentation.

3. **Hairlines, not boxes.** Print rooms organize space with rules, not cards.
   Chrome uses 1px hairline dividers, generous whitespace, and small-caps
   letterspaced labels (the pica-ruler voice). No drop shadows on chrome, no
   rounded-card vocabulary, border-radius at most 2px. Density comes from
   typography, not from container decoration.

4. **State is a stamp.** Save state (saved/saving/dirty/error), publish state
   (private/public), and "published edition is behind the working copy" are
   shown as *proofing stamps*: compact, mono-spaced, unambiguous tokens in the
   job-ticket strip — not toasts, not animated spinners. Error state is the only
   thing allowed to use registration red (`#C0392B` family), and red always
   means "needs the author's hand".

5. **The reader gets the print, not the room.** Reader-facing surfaces (public
   directory, login) carry the same bone/ink typographic voice but *zero*
   instrumentation — no blue anywhere a reader stands. The public directory is a
   table of contents, set like a colophon page: title, rule, indented tree,
   page numbers' role played by publish dates.

## 3. Information architecture decisions

- **Three-zone bench.** Left: *the rack* (folder tree + page list) — narrow,
  ink-on-bone, collapsible. Center: *the light table* (canvas inside a framed
  sheet with a job-ticket strip above it). Right: *the spec sheet* (Properties
  inspector) — selection-driven, collapsible, hairline-separated sections.

- **Job ticket, not toolbar.** The page header is a single horizontal strip
  reading left→right in workflow order: title (editable, set large, it is the
  job's name) → instrument toggles (gravity, theme pin) → state stamps
  (save state, visibility) → the press action (Publish) at the far right end,
  the only filled button in the chrome. Publish is deliberately *heavier* than
  everything else: the two-state model means it is the one consequential act.

- **The palette is a tray of galleys.** Block types live in a slim tray docked
  to the light table's left edge — small labeled tiles (markdown / image /
  code) you drag onto the sheet. It belongs to the table, not to the rack:
  inserting is a canvas act, not a navigation act.

- **The spec sheet reads top-down by selection.** Page selected → page stock
  (background color/image). Block selected → shell options as stamp-chips, then
  the block's own tools (code language, image alt). Section headers are
  small-caps hairline-ruled labels; the inspector never scrolls horizontally.

- **Login is the shop door.** A single centered card on bone paper with the
  instance name set like a shop sign — registration disabled is presented as a
  fact of the trade ("single-author press"), not an apology.

- **Admin is the back office.** Theme selection, customization, export/import,
  GC — same chrome voice, form-like, no spectacle.

## 4. Typographic system

- Chrome UI: system grotesque stack (`system-ui`/Inter-alike) for body;
  `ui-monospace` for *all* numerals, stamps, coordinates, and labels that
  behave like instrument readouts.
- Labels: 11px, small-caps or uppercase, +0.08em letterspacing, graphite-60%.
- One scale: 11 / 13 / 15 / 20 px. No fluid type in chrome.

## 5. Trade-offs accepted

- **Flatness over affordance familiarity.** Hairline chrome gives fewer "this
  is a button" cues than rounded-card UI. Mitigated by hover states (ink
  deepens, blue appears) and by keeping interactive density low.
- **Fixed chrome palette over theme-matching chrome.** A dark content theme
  next to bone chrome is a real contrast seam. Accepted deliberately: the seam
  *is* the sheet edge — it tells the author what the reader will and won't see.
- **One accent (blue) + one alarm (red) over a status rainbow.** Some states
  (e.g., "published but stale") must be carried by wording + stamp shape rather
  than a third hue. Accepted for vocabulary discipline.
- **No animation language beyond micro-transitions.** A paste-up room does not
  animate. Drag feedback is positional, not theatrical.

## 6. What success looks like

Open the editor next to any of the three reference themes: the chrome should
feel like the same quiet room around three different sheets. A reader opening a
published page or the public directory should find no trace of the room at all.
