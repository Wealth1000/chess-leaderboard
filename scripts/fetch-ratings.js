const https = require('https');
const fs = require('fs');
const path = require('path');

const GIST_ID = process.env.GIST_ID;
const GIST_TOKEN = process.env.GIST_TOKEN;
const RESET_SNAPSHOTS = process.env.RESET_SNAPSHOTS === '1';
const PLAYERS_FILE = path.join(__dirname, '../data/players.json');
const SNAPSHOT_FILENAME = 'snapshots.json';
const REQUEST_TIMEOUT_MS = 20000;

const CATEGORIES = ['rapid', 'classical', 'blitz', 'bullet', 'puzzle'];

// Chess.com exposes Daily rather than Classical, and has no current puzzle rating.
// Each source is requested explicitly; there is no "first available" fallback.
const CHESSCOM_SOURCES = {
  rapid: 'chess_rapid',
  classical: 'chess_daily',
  blitz: 'chess_blitz',
  bullet: 'chess_bullet'
};

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function emptyRatings() {
  return Object.fromEntries(CATEGORIES.map(category => [category, null]));
}

function emptyChessComExtras() {
  return { tacticsHigh: null, puzzleRushBest: null };
}

// Read each category independently so a malformed entry cannot hide the others.
function readChessComCategory(stats, source) {
  try {
    const rating = stats?.[source]?.last?.rating;
    return isNumber(rating) ? rating : null;
  } catch (error) {
    return null;
  }
}

function parseChessComStats(stats) {
  const ratings = emptyRatings();

  for (const category of CATEGORIES) {
    if (category === 'puzzle') {
      // Chess.com publishes tactics high and Puzzle Rush best, not a current
      // puzzle rating. The puzzle category is therefore always unavailable.
      ratings.puzzle = null;
      continue;
    }

    ratings[category] = readChessComCategory(stats, CHESSCOM_SOURCES[category]);
  }

  const extras = emptyChessComExtras();

  try {
    const tacticsHigh = stats?.tactics?.highest?.rating;
    extras.tacticsHigh = isNumber(tacticsHigh) ? tacticsHigh : null;
  } catch (error) {
    extras.tacticsHigh = null;
  }

  try {
    const puzzleRushBest = stats?.puzzle_rush?.best?.score;
    extras.puzzleRushBest = isNumber(puzzleRushBest) ? puzzleRushBest : null;
  } catch (error) {
    extras.puzzleRushBest = null;
  }

  return { ratings, extras };
}

function parseLichessStats(stats) {
  const ratings = emptyRatings();

  for (const category of CATEGORIES) {
    try {
      const perf = stats?.perfs?.[category];
      const games = perf?.games;
      const rating = perf?.rating;

      // Lichess keeps default provisional ratings for unplayed categories.
      // Require real games before treating the value as a rating.
      ratings[category] = isNumber(games) && games > 0 && isNumber(rating)
        ? rating
        : null;
    } catch (error) {
      ratings[category] = null;
    }
  }

  return { ratings };
}

function buildAccountRatings(username, platform, ratings) {
  return CATEGORIES.map(category => ({
    username,
    platform,
    category,
    rating: isNumber(ratings[category]) ? ratings[category] : null
  }));
}

function mergeSnapshots(existingSnapshots, newSnapshots, date, reset) {
  const kept = reset || !Array.isArray(existingSnapshots)
    ? []
    : existingSnapshots.filter(snapshot => (
      snapshot &&
      typeof snapshot === 'object' &&
      snapshot.date !== date
    ));

  return { snapshots: [...kept, ...newSnapshots] };
}

function formatRatings(ratings) {
  return CATEGORIES
    .map(category => `${category} ${ratings[category] ?? '—'}`)
    .join(' | ');
}

function formatChessComExtras(extras) {
  return `tactics high ${extras.tacticsHigh ?? '—'} | puzzle rush ${extras.puzzleRushBest ?? '—'}`;
}

function requestJson(options, label) {
  return new Promise((resolve) => {
    const req = https.get(options, (res) => {
      let body = '';

      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const preview = body.trim().slice(0, 160);
          console.error(`  ${label}: HTTP ${res.statusCode}${preview ? ` (${preview})` : ''}`);
          resolve(null);
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (error) {
          console.error(`  ${label}: invalid JSON response`);
          resolve(null);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`  ${label}: ${error.message}`);
      resolve(null);
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
  });
}

async function fetchChessComStats(username) {
  const json = await requestJson({
    hostname: 'api.chess.com',
    path: `/pub/player/${encodeURIComponent(username)}/stats`,
    method: 'GET',
    headers: { 'User-Agent': 'ChessLeaderboard/1.0' }
  }, `chess.com ${username}`);

  if (!json) {
    return { ratings: emptyRatings(), extras: emptyChessComExtras() };
  }

  try {
    return parseChessComStats(json);
  } catch (error) {
    console.error(`  chess.com ${username}: could not parse stats (${error.message})`);
    return { ratings: emptyRatings(), extras: emptyChessComExtras() };
  }
}

async function fetchLichessStats(username) {
  const json = await requestJson({
    hostname: 'lichess.org',
    path: `/api/user/${encodeURIComponent(username)}?profile=true`,
    method: 'GET',
    headers: { 'User-Agent': 'ChessLeaderboard/1.0' }
  }, `lichess ${username}`);

  if (!json) {
    return { ratings: emptyRatings() };
  }

  try {
    return parseLichessStats(json);
  } catch (error) {
    console.error(`  lichess ${username}: could not parse stats (${error.message})`);
    return { ratings: emptyRatings() };
  }
}

function fetchExistingSnapshots() {
  return requestJson({
    hostname: 'api.github.com',
    path: `/gists/${GIST_ID}`,
    method: 'GET',
    headers: { 'User-Agent': 'ChessLeaderboard/1.0' }
  }, 'gist').then((gist) => {
    if (!gist) {
      console.log('No existing gist data, starting fresh');
      return { snapshots: [] };
    }

    const snapshotFile = gist.files?.[SNAPSHOT_FILENAME];
    if (!snapshotFile?.content) {
      console.log('No existing snapshot file, starting fresh');
      return { snapshots: [] };
    }

    try {
      const parsed = JSON.parse(snapshotFile.content);
      return {
        snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : []
      };
    } catch (error) {
      console.error('Existing gist snapshot file is invalid JSON, starting fresh');
      return { snapshots: [] };
    }
  });
}

function updateGist(snapshots) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      files: {
        [SNAPSHOT_FILENAME]: { content: JSON.stringify(snapshots, null, 2) }
      }
    });

    const req = https.request({
      hostname: 'api.github.com',
      path: `/gists/${GIST_ID}`,
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'User-Agent': 'ChessLeaderboard/1.0',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Gist updated successfully');
          resolve();
        } else {
          console.error(`Failed to update gist: ${res.statusCode}`);
          console.error(body);
          reject(new Error(body));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`gist update timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.write(data);
    req.end();
  });
}

async function buildPlayerSnapshot(player, today) {
  const ratings = [];
  let chessComExtras = null;

  if (player.chessCom) {
    const username = player.chessCom.toLowerCase();
    try {
      const result = await fetchChessComStats(username);
      ratings.push(...buildAccountRatings(username, 'chess.com', result.ratings));
      chessComExtras = result.extras;
      console.log(`  chess.com (${username}): ${formatRatings(result.ratings)} | ${formatChessComExtras(result.extras)}`);
    } catch (error) {
      console.error(`  chess.com (${username}): ${error.message}`);
      ratings.push(...buildAccountRatings(username, 'chess.com', emptyRatings()));
      chessComExtras = emptyChessComExtras();
    }
  }

  if (player.lichess) {
    try {
      const result = await fetchLichessStats(player.lichess);
      ratings.push(...buildAccountRatings(player.lichess, 'lichess', result.ratings));
      console.log(`  lichess (${player.lichess}): ${formatRatings(result.ratings)}`);
    } catch (error) {
      console.error(`  lichess (${player.lichess}): ${error.message}`);
      ratings.push(...buildAccountRatings(player.lichess, 'lichess', emptyRatings()));
    }
  }

  const snapshot = {
    playerId: player.id,
    playerName: player.name,
    date: today,
    ratings
  };

  // Extras are Chess.com-only; Lichess snapshots omit the field entirely.
  if (chessComExtras) {
    snapshot.chessComExtras = chessComExtras;
  }

  return snapshot;
}

async function main() {
  if (!GIST_ID || !GIST_TOKEN) {
    console.error('Missing GIST_ID or GIST_TOKEN environment variables');
    process.exit(1);
  }

  console.log('🔄 Fetching chess ratings...\n');

  if (RESET_SNAPSHOTS) {
    console.log('🧹 RESET_SNAPSHOTS=1: ignoring existing history and writing only this run\n');
  }

  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const existing = RESET_SNAPSHOTS
    ? { snapshots: [] }
    : await fetchExistingSnapshots();

  const newSnapshots = [];

  for (const player of players.players) {
    console.log(`Fetching ${player.name}...`);

    try {
      newSnapshots.push(await buildPlayerSnapshot(player, today));
    } catch (error) {
      console.error(`  ${player.name}: unexpected failure (${error.message})`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const replaced = existing.snapshots.filter(snapshot => (
    snapshot && typeof snapshot === 'object' && snapshot.date === today
  )).length;
  const merged = mergeSnapshots(existing.snapshots, newSnapshots, today, RESET_SNAPSHOTS);

  if (replaced > 0) {
    console.log(`♻️  Replacing ${replaced} existing snapshot(s) for ${today}`);
  }

  console.log(`\n✅ Wrote ${newSnapshots.length} snapshots for ${today}`);
  console.log(`📊 Total snapshots: ${merged.snapshots.length}`);

  await updateGist(merged);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  CATEGORIES,
  parseChessComStats,
  parseLichessStats,
  buildAccountRatings,
  mergeSnapshots
};
