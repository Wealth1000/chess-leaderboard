# Chess Leaderboard

A shared rating tracker for our chess group. Pulls daily snapshots from chess.com and Lichess APIs.

## How it works

1. **Data**: Player usernames stored in `data/players.json`
2. **Daily updates**: GitHub Action fetches ratings every day at 9am UTC and updates a GitHub Gist
3. **Static site**: Pure HTML/CSS/JS, no build step needed

## Setup

1. Edit `data/players.json` to add your group members
2. Commit and push
3. The GitHub Action will start collecting data

## Adding Players

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

Only fill in the platforms each player uses. Use lowercase for chess.com usernames.

## Architecture

- **Frontend**: Static HTML with Chart.js (loaded from CDN)
- **Data storage**: GitHub Gist (updated daily by GitHub Action)
- **API polling**: Node.js script fetches from chess.com and Lichess APIs
