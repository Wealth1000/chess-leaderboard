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
- **Charts**: Chart.js is loaded on demand when a player scorecard opens
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
   GitHub Gist.
3. **Live ratings**: On page load, `hooks/use-snapshots.ts` fetches the gist and
   `lib/leaderboard.ts` ranks the latest snapshot. A failed fetch leaves the
   player list usable and shows a data warning.

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
usernames.

## Gist configuration

The daily fetch workflow needs these repository secrets:

- `GIST_ID`
- `GIST_TOKEN`

The site reads the public gist URL defined in `lib/gist.ts`.
