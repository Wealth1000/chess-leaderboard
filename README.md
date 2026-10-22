# Chess Leaderboard

A shared rating tracker for our chess group. Pulls daily snapshots from chess.com and Lichess APIs.

## Setup

1. Edit `src/app/data/players.json` to add your group members
2. Commit and push to trigger the first data fetch
3. The GitHub Action will run daily to update ratings

## Development

```bash
npm install
npm run dev
```

## Adding Players

Edit `src/app/data/players.json`:

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

Only fill in the platforms each player uses.
