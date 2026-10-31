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

// Cumulative games played for a Chess.com category, summed from the record's
// win/loss/draw counts. The classical record also carries `time_per_move` and
// `timeout_percent`; only the three numeric result counts are read, so those
// non-result keys are ignored. A category with no usable record yields null
// (omitted), never 0 — "unknown" and "played none" stay distinguishable.
function readChessComGames(stats, source) {
  try {
    const record = stats?.[source]?.record;

    if (!record || typeof record !== 'object') {
      return null;
    }

    let total = 0;
    let seen = false;

    for (const key of ['win', 'loss', 'draw']) {
      const value = record[key];

      if (isNumber(value)) {
        total += value;
        seen = true;
      }
    }

    return seen ? total : null;
  } catch (error) {
    return null;
  }
}

function readLichessGames(stats, category) {
  try {
    const games = stats?.perfs?.[category]?.games;
    return isNumber(games) ? games : null;
  } catch (error) {
    return null;
  }
}

function parseChessComStats(stats) {
  const ratings = emptyRatings();
  const gamesPlayed = {};

  for (const category of CATEGORIES) {
    if (category === 'puzzle') {
      // Chess.com publishes tactics high and Puzzle Rush best, not a current
      // puzzle rating. The puzzle category is therefore always unavailable,
      // and it never gets a game count.
      ratings.puzzle = null;
      continue;
    }

    const source = CHESSCOM_SOURCES[category];
    ratings[category] = readChessComCategory(stats, source);

    const games = readChessComGames(stats, source);
    if (games !== null) {
      gamesPlayed[category] = games;
    }
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

  return { ratings, gamesPlayed, extras };
}

function parseLichessStats(stats) {
  const ratings = emptyRatings();
  const gamesPlayed = {};

  for (const category of CATEGORIES) {
    try {
      const perf = stats?.perfs?.[category];
      const games = perf?.games;
      const rating = perf?.rating;

      // Lichess keeps default provisional ratings for unplayed categories.
      // Require real games before treating the value as a rating.
      const hasRating = isNumber(games) && games > 0 && isNumber(rating);
      ratings[category] = hasRating ? rating : null;

      // Puzzle never gets a game count; other categories carry the cumulative
      // `perfs.<category>.games` only when the rating is real.
      if (category !== 'puzzle' && hasRating) {
        const count = readLichessGames(stats, category);
        if (count !== null) {
          gamesPlayed[category] = count;
        }
      }
    } catch (error) {
      ratings[category] = null;
    }
  }

  return { ratings, gamesPlayed };
}

function buildAccountRatings(username, platform, ratings) {
  return CATEGORIES.map(category => ({
    username,
    platform,
    category,
    rating: isNumber(ratings[category]) ? ratings[category] : null
  }));
}

// A category is "v2" when its entry carries an `accounts` object. The document
// may legitimately mix shapes during the transition, so every reader detects the
// shape per entry rather than trusting the document-level `version`.
function isV2Entry(entry) {
  return !!entry && typeof entry === 'object' && !Array.isArray(entry) &&
    !!entry.accounts && typeof entry.accounts === 'object' && !Array.isArray(entry.accounts);
}

function isV2Document(document) {
  return !!document && typeof document === 'object' && document.version === 2;
}

// Build one account entry in the v2 compact shape. Numeric ratings go in
// `ratings`; every other category (including Chess.com's always-unavailable
// puzzle) goes in `unplayed`, which is load-bearing and must not be collapsed
// into "absent". `gamesPlayed` is omitted entirely when empty, and counts are
// only attached to categories that actually have a rating.
function buildV2Account(username, ratings, gamesPlayed) {
  const outRatings = {};
  const unplayed = [];

  for (const category of CATEGORIES) {
    if (isNumber(ratings?.[category])) {
      outRatings[category] = ratings[category];
    } else {
      unplayed.push(category);
    }
  }

  const account = { username, ratings: outRatings, unplayed };

  const counts = {};
  for (const category of CATEGORIES) {
    const count = gamesPlayed?.[category];
    if (Object.prototype.hasOwnProperty.call(outRatings, category) && isNumber(count)) {
      counts[category] = count;
    }
  }

  if (Object.keys(counts).length > 0) {
    account.gamesPlayed = counts;
  }

  return account;
}

// Build a v2 snapshot. `accounts` and `chessComExtras` are omitted when empty
// so a member with no accounts writes the same minimal record as today.
function buildV2Snapshot(playerId, date, accounts, chessComExtras) {
  const snapshot = { playerId, date };

  const accountEntries = Object.entries(accounts || {});
  if (accountEntries.length > 0) {
    snapshot.accounts = Object.fromEntries(accountEntries);
  }

  if (chessComExtras) {
    snapshot.chessComExtras = chessComExtras;
  }

  return snapshot;
}

function buildDocument(snapshots) {
  return { version: 2, snapshots: Array.isArray(snapshots) ? snapshots : [] };
}

// The gist file is minified: no indentation, no surrounding whitespace. Accepts
// either a bare snapshots array or a `{ snapshots }` wrapper so a merged result
// can be encoded directly.
function encodeDocument(input) {
  const snapshots = Array.isArray(input)
    ? input
    : (Array.isArray(input?.snapshots) ? input.snapshots : []);
  return JSON.stringify(buildDocument(snapshots));
}

// Build an old id -> current id map from the optional `formerIds` field in
// players.json. A rename keeps the member's history because the existing
// snapshots still carry the old id; remapping on the way in means a rename
// costs no extra API calls and no reset. Invalid entries are ignored rather
// than fatal so a typo can never break the daily update.
function buildFormerIdMap(players, formerIds) {
  if (!formerIds || typeof formerIds !== 'object' || Array.isArray(formerIds)) {
    return new Map();
  }

  const liveIds = new Set(
    (Array.isArray(players) ? players : [])
      .map(player => player?.id)
      .filter(id => typeof id === 'string' && id)
  );

  const map = new Map();
  const claimed = new Set();

  for (const [currentId, former] of Object.entries(formerIds)) {
    const formerList = Array.isArray(former) ? former : [former];

    for (const formerId of formerList) {
      if (typeof formerId !== 'string' || !formerId) {
        console.warn(`⚠️  formerIds: ignoring invalid entry for "${currentId}"`);
        continue;
      }

      if (liveIds.has(formerId)) {
        console.warn(`⚠️  formerIds: "${formerId}" is also a live player id, ignoring`);
        continue;
      }

      if (claimed.has(formerId)) {
        console.warn(`⚠️  formerIds: "${formerId}" maps to more than one player, ignoring`);
        continue;
      }

      if (!liveIds.has(currentId)) {
        console.warn(`⚠️  formerIds: "${currentId}" is not a current player id, ignoring "${formerId}"`);
        continue;
      }

      claimed.add(formerId);
      map.set(formerId, currentId);
    }
  }

  return map;
}

// Rewrite snapshot player ids that used to be another member's id. Snapshots
// keyed by an id that is neither current nor a known former id are left
// untouched.
function remapFormerIds(snapshots, formerIdMap) {
  if (!Array.isArray(snapshots) || formerIdMap.size === 0) {
    return snapshots;
  }

  return snapshots.map(snapshot => {
    const mapped = snapshot?.playerId && formerIdMap.get(snapshot.playerId);
    return mapped ? { ...snapshot, playerId: mapped } : snapshot;
  });
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
    return { ratings: emptyRatings(), gamesPlayed: {}, extras: emptyChessComExtras() };
  }

  try {
    return parseChessComStats(json);
  } catch (error) {
    console.error(`  chess.com ${username}: could not parse stats (${error.message})`);
    return { ratings: emptyRatings(), gamesPlayed: {}, extras: emptyChessComExtras() };
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
    return { ratings: emptyRatings(), gamesPlayed: {} };
  }

  try {
    return parseLichessStats(json);
  } catch (error) {
    console.error(`  lichess ${username}: could not parse stats (${error.message})`);
    return { ratings: emptyRatings(), gamesPlayed: {} };
  }
}

// Accept either stored document shape — v1 (`{ snapshots: [...] }`, no version)
// or v2 — and return the entries exactly as they were stored. Legacy entries are
// never normalised or upgraded here; the site upgrades them at read time. The
// document may therefore hold a mix of v1 and v2 entries.
function readExistingDocument(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { version: null, snapshots: [] };
  }

  return {
    version: isV2Document(parsed) ? 2 : null,
    snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : []
  };
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
      return readExistingDocument(parsed);
    } catch (error) {
      console.error('Existing gist snapshot file is invalid JSON, starting fresh');
      return { version: null, snapshots: [] };
    }
  });
}

function updateGist(snapshots) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      files: {
        [SNAPSHOT_FILENAME]: { content: encodeDocument(snapshots) }
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
  const accounts = {};
  let chessComExtras = null;

  if (player.chessCom) {
    const username = player.chessCom.toLowerCase();
    try {
      const result = await fetchChessComStats(username);
      accounts['chess.com'] = buildV2Account(username, result.ratings, result.gamesPlayed);
      chessComExtras = result.extras;
      console.log(`  chess.com (${username}): ${formatRatings(result.ratings)} | ${formatChessComExtras(result.extras)}`);
    } catch (error) {
      console.error(`  chess.com (${username}): ${error.message}`);
      accounts['chess.com'] = buildV2Account(username, emptyRatings(), {});
      chessComExtras = emptyChessComExtras();
    }
  }

  if (player.lichess) {
    try {
      const result = await fetchLichessStats(player.lichess);
      accounts.lichess = buildV2Account(player.lichess, result.ratings, result.gamesPlayed);
      console.log(`  lichess (${player.lichess}): ${formatRatings(result.ratings)}`);
    } catch (error) {
      console.error(`  lichess (${player.lichess}): ${error.message}`);
      accounts.lichess = buildV2Account(player.lichess, emptyRatings(), {});
    }
  }

  // `playerName` is deliberately absent: display names come from players.json.
  // `username` stays inside each account — it is the identity gate.
  return buildV2Snapshot(player.id, today, accounts, chessComExtras);
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
  const formerIdMap = buildFormerIdMap(players.players, players.formerIds);
  const today = new Date().toISOString().slice(0, 10);
  const existing = RESET_SNAPSHOTS
    ? { snapshots: [] }
    : await fetchExistingSnapshots();

  if (formerIdMap.size > 0) {
    const remapped = existing.snapshots.filter(snapshot => (
      snapshot?.playerId && formerIdMap.has(snapshot.playerId)
    )).length;
    const renamed = [...formerIdMap.entries()]
      .map(([from, to]) => `${from} → ${to}`)
      .join(', ');
    console.log(`🔁 Remapping renamed id(s): ${renamed}`);
    console.log(remapped > 0
      ? `   Remapped ${remapped} stored snapshot(s) to current id(s)`
      : '   (no stored snapshots needed remapping)');
    existing.snapshots = remapFormerIds(existing.snapshots, formerIdMap);
  }

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
  CHESSCOM_SOURCES,
  parseChessComStats,
  parseLichessStats,
  buildAccountRatings,
  mergeSnapshots,
  buildFormerIdMap,
  remapFormerIds,
  readChessComGames,
  readLichessGames,
  isV2Entry,
  isV2Document,
  buildV2Account,
  buildV2Snapshot,
  buildDocument,
  encodeDocument,
  readExistingDocument
};
