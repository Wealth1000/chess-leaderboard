# Chess Leaderboard

A shared rating tracker for our chess group. Ratings are pulled daily from public
chess.com and Lichess profiles, then ranked on a club chessboard or read as a
ranked list.

## Architecture

- **Framework**: Next.js App Router with a static export (`output: "export"`)
- **UI**: React components with CSS Modules; fonts self-hosted by `next/font`
- **Build-time data**: Player metadata is baked in at build time from
  `data/players.json`
- **Fresh ratings**: The browser fetches the latest snapshots from a GitHub Gist,
  so a new rating update appears without rebuilding the site
- **Charts**: Chart.js is loaded on demand for the player scorecard history and
  the composite all-player field chart
- **Platforms and categories**: The view bar re-ranks the whole site, including
  the hero, board, scorecards, and charts, using one platform and one category
  at a time. Rankings always use the latest rating; the selected range only
  controls change indicators and chart windows.
- **Board and list**: The rankings section offers a Board / List switch. Both
  presentations render the same ranked model in the same order; the list is a
  table view of the standings, not a second ranking.
- **Joining**: Members add themselves at `/join/`. The form verifies handles
  against the public APIs in the browser and posts the request to Formspree, so
  no GitHub account is needed. A maintainer actions the request by running the
  `Add Player` workflow, which is the only thing that writes to the repo.
- **Hidden players**: A member with no account on the selected platform is hidden
  from the board and list by default. Hiding is presentational only; the ranked
  model is never filtered, and a toggle (plus search) can reveal everyone.
- **Chart range**: The field chart clamps its y-axis to the 90th percentile when
  enough lines are plotted, so the dense middle of the field is readable. Lines
  are never dropped, the caption states how many sit above the axis, and a
  toggle restores the full range.
- **Theming**: Semantic tokens in `app/globals.css` define the palette. Component
  styles and chart colors read those tokens instead of literal colors.
- **Hosting**: GitHub Pages, deployed by the workflow in `.github/workflows/deploy.yml`

## Project layout

```text
app/            Next.js app shell, metadata, fonts, global styles
components/     Leaderboard UI (board, list table, hero, scorecards, chart) + CSS Modules
hooks/          Client-side data hooks
lib/            Types, player data, ranking, formatting, history, gist client
data/           Committed player list
scripts/        Daily rating fetcher, join-action helper
public/         Static files (including .nojekyll for GitHub Pages)
```

## Development

This project uses **pnpm**.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

Useful checks:

```bash
pnpm typecheck
pnpm build
```

The production build writes a static site to `out/`.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`, which installs with pnpm,
builds the static site, and publishes `out/` to GitHub Pages.

The site is **open by default**. The build does not set a closure flag, so a
routine push publishes the live leaderboard. The under-construction page is kept
as a kill switch that takes the site down reliably during maintenance.

The production site is served from a repository subpath, so the build sets:

```bash
NEXT_PUBLIC_BASE_PATH=/chess-leaderboard pnpm build
```

For local development the base path is empty. To preview a production build
locally, run the command above, then serve `out/` under `/chess-leaderboard/`.

### Closing the site temporarily

The kill switch is the `SITE_CLOSED` check in the app, driven by the
`NEXT_PUBLIC_SITE_CLOSED` build variable. To take the site down, set it to
`"true"` in the "Build static site" step's `env` in
`.github/workflows/deploy.yml`:

```yaml
      - name: Build static site
        run: pnpm build
        env:
          NEXT_PUBLIC_BASE_PATH: /chess-leaderboard
          NEXT_PUBLIC_SITE_CLOSED: "true"
```

Then push to `main` (or run the workflow manually) to redeploy. The closure page
keeps its suggestion form (Formspree when configured, otherwise a pre-filled
GitHub issue), so members can still reach you.

To reopen, remove the `NEXT_PUBLIC_SITE_CLOSED` line again and redeploy. When the
variable is absent the app defaults to open; no app code changes are needed for
either direction. The same flag works for a local preview build if you want to
check the closure page.

## Board and list views

The rankings section has a **Board / List** switch next to the player search. The
chessboard is the default and keeps its open-seat conceit; the list renders the
same ranking as a table (rank, player, handle, rating, and the change for the
selected range). Search, counts, empty states, and scorecards behave the same in
both views.

The choice is stored with the rest of the view state under the existing key
(`chess-leaderboard:view-state:v1`), so the platform, category, range, and focused
player persist alongside it. A stored payload that predates the layout field, or
one with an unrecognized layout value, opens on the board.

## Hidden players

A member who has no account on the selected platform is hidden from the board and
list by default. On the Chess.com view that is nearly nobody; on the Lichess view
it is most of the group, and a row reading "No Lichess account" is noise rather
than a standing.

- The `N hidden` toggle beside Board / List reveals them, and the label flips to
  `Hide N hidden`. The choice persists as `showHidden`.
- Search always overrides hiding: naming a member is intent, so a hidden member
  who matches the query appears.
- The hero's player count, the open-seat note, the section count, and the
  scorecard's "rank X of Y" all describe the set on screen, not the raw list.
- Hiding is cosmetic. `buildRatingsView` still ranks every member, so revealing
  them restores their real rank and history with no recomputation.

## Chart range

The field chart's y-axis stops at the 90th percentile of the plotted ratings,
rounded up to the next 50, once at least eight lines are drawn. Without it a
single 2300-rated member flattens the 700–1500 band where most of the group sits.

- No line is filtered. Outliers are clipped by the axis, not removed from the
  dataset, legend, or tooltip.
- A caption states the ceiling and how many members sit above it, and a
  **Show full range** control restores the unclamped axis (persisted as
  `fullChartRange`).
- Below eight plotted players the percentile is noise, so the chart keeps its
  full axis.

## Theme tokens

The palette is expressed as semantic tokens in `app/globals.css` (`--page`,
`--surface`, `--ink`, `--ink-muted`, `--line`, `--line-strong`, `--accent`,
`--accent-strong`, `--gold`, `--board-light`, `--board-dark`, and the chart
tokens). Components must style with tokens rather than literal colors.

Charts read the same tokens at runtime, so CSS and canvas cannot drift apart. Gold
is a highlight for ink surfaces only; it is never used for focus indicators or
small text on the cream background, where rust (`--accent-strong`) or ink carries
focus and small accent text.

## Data flow

1. **Player list**: Edit `data/players.json`, or let the `Add Player` workflow
   append a verified join request. Changes require a rebuild because the list is
   imported at build time (the workflow's push triggers one).
2. **Daily snapshots**: `.github/workflows/daily-update.yml` runs
   `scripts/fetch-ratings.js` every day at 09:00 UTC and writes the results to a
   GitHub Gist. Each account records its five category outcomes (a rating, or
   `unplayed`). Re-running on the same day replaces that day's snapshots instead
   of skipping the run.
3. **Live ratings**: On page load, `hooks/use-snapshots.ts` fetches the gist and
   the view model ranks the latest snapshot for the selected platform and
   category. A failed fetch leaves the player list usable and shows a data
   warning.

## Rating categories

The fetcher requests every supported category explicitly. There is no
"first available rating" fallback, so a missing category can never silently
become a blitz or rapid rating.

| Category        | Chess.com source   | Lichess source    |
| --------------- | ------------------ | ----------------- |
| Rapid           | `chess_rapid`      | `perfs.rapid`     |
| Classical/Daily | `chess_daily`      | `perfs.classical` |
| Blitz           | `chess_blitz`      | `perfs.blitz`     |
| Bullet          | `chess_bullet`     | `perfs.bullet`    |
| Puzzle          | Not published      | `perfs.puzzle`    |

Rules:

- Chess.com calls the category Daily; the site stores and displays it as
  Classical.
- Chess.com has no current public puzzle rating. Its Puzzle entry is stored as
  `null`. `tactics.highest.rating` and `puzzle_rush.best.score` are stored as
  scorecard extras instead and never enter ranking or focus comparisons.
- A Lichess performance with `games === 0` or no performance object is `null`,
  even when Lichess supplies a provisional default such as 1500.
- A `null` rating and a missing rating both mean unavailable, never zero.
- Chess.com usernames are lowercased in API requests.

The gist holds a **versioned document**: a `version` field plus a `snapshots`
array. A missing `version` means v1 (the pre-v2 format). The fetcher writes
`version: 2`; the file is minified (`JSON.stringify` with no indentation or
surrounding whitespace) to keep the payload small on page load, since the
browser fetches it on every visit.

Each member emits one v2 snapshot entry, and each account is a compact record
inside `accounts`:

```jsonc
{
  "version": 2,
  "snapshots": [
    {
      "playerId": "wealth",
      "date": "2026-10-31",
      "accounts": {
        "chess.com": {
          "username": "wealth98981",
          "ratings": { "rapid": 1300 },
          "unplayed": ["puzzle"],
          "gamesPlayed": { "rapid": 3712 }
        }
      },
      "chessComExtras": { "tacticsHigh": 1800, "puzzleRushBest": 32 }
    }
  ]
}
```

The example shows one rating for brevity; a real account includes `rapid`,
`classical`, `blitz`, and `bullet` (and `puzzle` for Lichess), each either in
`ratings` with a numeric value or in `unplayed`. `chessComExtras` is present only
for players with a Chess.com account; Lichess-only snapshots omit it.

Fields worth knowing:

- **`username`** lives inside each account record and is the identity gate. It is
  never deduplicated away, so a member can never inherit another account's
  ratings.
- **`unplayed`** lists categories where the account exists but the value is
  unavailable (rendered "Not played" / "Not published"). A category in neither
  `ratings` nor `unplayed` means no data and renders "—". The three-way
  played / unplayed / absent distinction is load-bearing and preserved on read.
- **`gamesPlayed`** maps a category to a cumulative game count. It is omitted
  entirely when no count is known (never defaulted to `0`), and **puzzle is never
  included**, on either platform. Counts are stored now so a future games-based
  feature can be derived from existing history rather than only from data
  collected after it ships.
- **`playerName` is dropped.** Nothing reads it; display names come from
  `data/players.json`.

Legacy entries are never rewritten. A v1 entry (a top-level `ratings` array, no
`accounts`) is preserved verbatim in the file and upgraded at read time, so
during the transition the document may legitimately hold a **mix** of v1 and v2
entries. Every reader detects the shape per entry, not from the document-level
`version`.

### Rollback

The site reads both formats, so reverting a deploy to the previous version is
safe: it still decodes the v1 entries and ignores what it does not recognise.
History is never at risk, and no migration step is needed in either direction.

## Resetting snapshots

The fetcher preserves history by default and replaces only the current date's
snapshots on a rerun. To clear all existing history and write only a new run,
set `RESET_SNAPSHOTS=1`:

```bash
RESET_SNAPSHOTS=1 GIST_ID=... GIST_TOKEN=... node scripts/fetch-ratings.js
```

This replaces the entire gist snapshot file, so use it only for a deliberate
reset. The daily workflow does not set this variable, so scheduled runs keep
history.

## Joining the ladder

Members join at `/join/`. No GitHub account, email address, or phone number is
needed. The form asks for:

- **WhatsApp tag** (the `id`): the name people tag them with in the group chat,
  e.g. `Wealth`. It is normalized to `[a-z0-9_]` (`Kwesi Boateng` →
  `kwesi_boateng`) and echoed back before submit. It is the snapshot key.
- **Display name**: optional, defaults to the tag.
- **Chess.com and/or Lichess username**: at least one, verified against the live
  APIs. A 404 means "no such account"; a 403, 429, or network failure means
  "couldn't verify" — the two are never reported as each other.

The form refuses a tag or handle already on the board, always with the same
sentence: DM the maintainer. There is no edit or delete path on the site.

### Submitting the request

The form posts to Formspree. Set these build-time variables (locally in
`.env.local`, and in the deploy workflow from repository variables):

| Variable | Used by |
| --- | --- |
| `NEXT_PUBLIC_FORMSPREE_JOIN_ID` | join form |
| `NEXT_PUBLIC_FORMSPREE_SUGGEST_ID` | suggestion form (`/suggest/` and the under-construction page) |

Only the form id is needed, not the full URL. These are public configuration,
not secrets: the id is inlined into the client bundle and visible in the
browser's network tab either way. In GitHub, set them under **Settings → Secrets
and variables → Actions → Variables** as `FORMSPREE_JOIN_ID` and
`FORMSPREE_SUGGEST_ID`; `deploy.yml` maps them to the two build variables. They
are build-time values, so changing one requires a new deploy.

Suggestions live at `/suggest/`, linked from the masthead next to "Join the
ladder". Without the join id the join page shows an "unavailable" notice instead
of the form; without the suggestion id, the suggestion form falls back to
opening a pre-filled GitHub issue. `_gotcha` is the honeypot; there is no
CAPTCHA.

### Actioning a request (maintainer)

Run **Actions → Add Player → Run workflow** with the submitted values:

- `whatsapp_tag` (required)
- `name` (blank uses the tag)
- `chess_com` and/or `lichess` (at least one)

The job re-validates server-side with `scripts/add-player.js` using the same
rules as the form, appends the member to `data/players.json`, runs the rating
fetcher (which also writes today's snapshot for the whole group), commits, and
pushes to `main`. The push triggers the Pages deploy. Any failed step aborts
before the commit, so a rejected request changes nothing. A concurrency group
keeps two runs from racing.

The `id` is immutable: a tag change is a `formerIds` remap, not a new id.

## Editing players.json by hand

The committed list is still the source of truth and can be edited directly:

```json
{
  "players": [
    {
      "id": "unique-id",
      "name": "Display Name",
      "chessCom": "chesscom-username",
      "lichess": "lichess-username"
    }
  ]
}
```

Only fill in the platforms each player uses. At least one of `chessCom` or
`lichess` is required. The join action stores the APIs' canonical casing; manual
entries may use any casing (Chess.com requests are lowercased).

`id` is the WhatsApp tag, normalized by `normalizePlayerId` (`lib/identity.ts`,
mirrored in `scripts/add-player.js` and pinned by a contract test). Rebuild after
editing, because the list is imported at build time.

### Dead accounts

The fetcher reports an account that 404s as `⚠️ account not found`, logs it per
member, and summarises the set at the end of the run. It never deletes anyone:
only the maintainer knows whether the account was renamed or abandoned. Two dead
entries (`walker5379`, `enko_hn2`) were removed from the list by hand after
repeated Chess.com 404s. Old snapshots for an id that is no longer in the list are
ignored by the site and can be pruned from the gist with a `GIST_TOKEN` if the
noise matters.

### Renaming a player id

Snapshots are keyed by `id`, so changing an id would normally orphan that
player's history. Record the old id in the optional `formerIds` map and the
fetcher rewrites the stored snapshots to the new id on the next run, so history
follows the rename with no reset and no extra API calls:

```json
{
  "players": [
    { "id": "beeba", "name": "Beeba", "chessCom": "unlikelyeffect" }
  ],
  "formerIds": {
    "beeba": ["unlikelyeffect"]
  }
}
```

Changing only `name` does not need `formerIds`. Use it only when the `id`
changes. Invalid entries (a former id that is still live, a current id that does
not exist, an id claimed twice) are ignored with a warning rather than failing
the daily run.

## Gist configuration

The daily fetch workflow needs these repository secrets:

- `GIST_ID`
- `GIST_TOKEN`

The site reads the public gist URL defined in `lib/gist.ts`.
