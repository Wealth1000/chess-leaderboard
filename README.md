# Chess Leaderboard

A shared rating tracker for our chess group. Ratings are pulled daily from public
chess.com and Lichess profiles, then ranked on a club chessboard.

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
- **Hosting**: GitHub Pages, deployed by the workflow in `.github/workflows/deploy.yml`

## Project layout

```text
app/            Next.js app shell, metadata, fonts, global styles
components/     Leaderboard UI (board, hero, scorecards, chart) + CSS Modules
hooks/          Client-side data hooks
lib/            Types, player data, ranking, formatting, history, gist client
data/           Committed player list
scripts/        Daily rating fetcher
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

The production site is served from a repository subpath, so the build sets:

```bash
NEXT_PUBLIC_BASE_PATH=/chess-leaderboard pnpm build
```

For local development the base path is empty. To preview a production build
locally, run the command above, then serve `out/` under `/chess-leaderboard/`.

## Data flow

1. **Player list**: Edit `data/players.json`. Changes require a rebuild because
   the list is imported at build time.
2. **Daily snapshots**: `.github/workflows/daily-update.yml` runs
   `scripts/fetch-ratings.js` every day at 09:00 UTC and writes the results to a
   GitHub Gist. Each account gets all five category entries. Re-running on the
   same day replaces that day's snapshots instead of skipping the run.
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

Each account emits five rating entries in the gist:

```json
{
  "playerId": "wealth",
  "playerName": "Wealth",
  "date": "2026-10-22",
  "ratings": [
    {
      "username": "wealth98981",
      "platform": "chess.com",
      "category": "rapid",
      "rating": 1300
    }
  ],
  "chessComExtras": {
    "tacticsHigh": 1800,
    "puzzleRushBest": 32
  }
}
```

The example shows one entry for brevity; a real account includes `rapid`,
`classical`, `blitz`, `bullet`, and `puzzle`. `chessComExtras` is present only
for players with a Chess.com account. Lichess-only snapshots omit it.

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

## Adding players

Edit `data/players.json`:

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

Only fill in the platforms each player uses. Use lowercase for chess.com
usernames. At least one of `chessCom` or `lichess` is required.

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
