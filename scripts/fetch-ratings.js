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

/**
 * Chess.com answers a genuine unknown user with a 404 whose body says
 * `User "name" not found.` It also answers some existing accounts with a 404
 * whose body says "An internal error has occurred". The status is the same;
 * the meaning is not. Only the first is evidence of absence. A missing body
 * (older fixtures) keeps the historical 404-means-missing behaviour.
 */
function isMissingResponse(status, body) {
  if (status !== 404) return false;
  if (typeof body !== 'string' || body.trim() === '') return true;

  const text = body.toLowerCase();
  if (text.includes('internal error')) return false;
  return text.includes('not found') || text.includes('notfound');
}

function isErrorPayload(json) {
  return !!json && typeof json === 'object' && !Array.isArray(json) &&
    !('chess_rapid' in json) && !('tactics' in json) &&
    ('message' in json || 'error' in json);
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

/**
 * Convert a legacy (v1) snapshot's flat `ratings` array into the v2 account
 * shape, so a rating from before the format migration can still be carried
 * forward. Missing categories become `unplayed`, exactly as the v2 writer
 * would have marked them.
 */
function legacyAccountFor(snapshot, platform) {
  if (!Array.isArray(snapshot.ratings)) return null;

  const entries = snapshot.ratings.filter(
    (entry) => entry && entry.platform === platform && typeof entry.username === 'string'
  );
  if (entries.length === 0) return null;

  const ratings = {};
  for (const entry of entries) {
    if (CATEGORIES.includes(entry.category)) {
      ratings[entry.category] = entry.rating;
    }
  }

  return buildV2Account(entries[0].username, ratings, {});
}

/**
 * The newest earlier snapshot that still carries numeric ratings for one
 * platform. Empty entries are skipped: those are the result of a failed fetch,
 * so using them as the fallback would keep the hole alive on every subsequent
 * run. Both v2 accounts and legacy v1 arrays are accepted, because the gist
 * mixes shapes during the transition.
 */
function latestAccount(snapshots, playerId, platform) {
  let best = null;

  for (const snapshot of snapshots || []) {
    if (!snapshot || snapshot.playerId !== playerId || !snapshot.date) continue;

    const account = isV2Entry(snapshot)
      ? snapshot.accounts?.[platform]
      : legacyAccountFor(snapshot, platform);

    if (!account || typeof account !== 'object') continue;
    if (!Object.values(account.ratings || {}).some(isNumber)) continue;

    if (!best || snapshot.date > best.date) {
      best = { date: snapshot.date, account };
    }
  }

  return best;
}

function latestChessComExtras(snapshots, playerId) {
  let best = null;

  for (const snapshot of snapshots || []) {
    if (!snapshot || snapshot.playerId !== playerId || !snapshot.date) continue;
    if (!snapshot.chessComExtras) continue;

    if (!best || snapshot.date > best.date) {
      best = { date: snapshot.date, extras: snapshot.chessComExtras };
    }
  }

  return best;
}

/**
 * A failed fetch must not erase a rating. Return the most recent account entry
 * for the same handle, or null when the handle changed (in which case the old
 * ratings belong to a different account and must not be borrowed).
 */
function carryForwardAccount(player, platform, previousSnapshots, username) {
  const carried = latestAccount(previousSnapshots, player.id, platform);
  if (!carried) return null;

  const stored = String(carried.account.username || '').toLowerCase();
  if (stored !== username.toLowerCase()) return null;

  return carried;
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
          resolve({ status: res.statusCode, json: null, body });
          return;
        }

        try {
          resolve({ status: res.statusCode, json: JSON.parse(body) });
        } catch (error) {
          console.error(`  ${label}: invalid JSON response`);
          resolve({ status: res.statusCode, json: null, body });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`  ${label}: ${error.message}`);
      resolve({ status: null, json: null });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
  });
}

async function fetchChessComStats(username, request = requestJson) {
  const { status, json, body } = await request({
    hostname: 'api.chess.com',
    path: `/pub/player/${encodeURIComponent(username)}/stats`,
    method: 'GET',
    headers: { 'User-Agent': 'ChessLeaderboard/1.0' }
  }, `chess.com ${username}`);

  if (!json) {
    const missing = isMissingResponse(status, body);
    return {
      ratings: emptyRatings(),
      gamesPlayed: {},
      extras: emptyChessComExtras(),
      missing,
      unavailable: !missing
    };
  }

  if (isErrorPayload(json)) {
    return {
      ratings: emptyRatings(),
      gamesPlayed: {},
      extras: emptyChessComExtras(),
      missing: false,
      unavailable: true
    };
  }

  try {
    return { ...parseChessComStats(json), missing: false, unavailable: false };
  } catch (error) {
    console.error(`  chess.com ${username}: could not parse stats (${error.message})`);
    return {
      ratings: emptyRatings(),
      gamesPlayed: {},
      extras: emptyChessComExtras(),
      missing: false,
      unavailable: true
    };
  }
}

async function fetchLichessStats(username, request = requestJson) {
  const { status, json, body } = await request({
    hostname: 'lichess.org',
    path: `/api/user/${encodeURIComponent(username)}?profile=true`,
    method: 'GET',
    headers: { 'User-Agent': 'ChessLeaderboard/1.0' }
  }, `lichess ${username}`);

  if (!json) {
    const missing = isMissingResponse(status, body);
    return {
      ratings: emptyRatings(),
      gamesPlayed: {},
      missing,
      unavailable: !missing
    };
  }

  if (isErrorPayload(json)) {
    return {
      ratings: emptyRatings(),
      gamesPlayed: {},
      missing: false,
      unavailable: true
    };
  }

  try {
    return { ...parseLichessStats(json), missing: false, unavailable: false };
  } catch (error) {
    console.error(`  lichess ${username}: could not parse stats (${error.message})`);
    return {
      ratings: emptyRatings(),
      gamesPlayed: {},
      missing: false,
      unavailable: true
    };
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

function fetchExistingSnapshots(request = requestJson) {
  return request({
    hostname: 'api.github.com',
    path: `/gists/${GIST_ID}`,
    method: 'GET',
    headers: {
      'Authorization': `token ${GIST_TOKEN}`,
      'User-Agent': 'ChessLeaderboard/1.0'
    }
  }, 'gist').then(({ status, json: gist }) => {
    if (!gist) {
      throw new Error(
        `Could not read the existing gist (HTTP ${status ?? 'network error'}). ` +
        'Refusing to overwrite history; re-run once GitHub is reachable.'
      );
    }

    const snapshotFile = gist.files?.[SNAPSHOT_FILENAME];
    if (!snapshotFile?.content) {
      throw new Error(
        `Existing gist has no ${SNAPSHOT_FILENAME}; refusing to start fresh. ` +
        'Use RESET_SNAPSHOTS=1 only for a deliberate reset.'
      );
    }

    try {
      const parsed = JSON.parse(snapshotFile.content);
      return readExistingDocument(parsed);
    } catch (error) {
      throw new Error(
        `Existing gist ${SNAPSHOT_FILENAME} is invalid JSON; refusing to overwrite it.`
      );
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

async function buildPlayerSnapshot(
  player,
  today,
  missingAccounts,
  previousSnapshots = [],
  unavailableAccounts = []
) {
  const accounts = {};
  let chessComExtras = null;

  // Reuse the last good account when today's fetch failed. Writing an empty
  // entry instead would make the member look unrated and would also be the
  // fallback for the next run, so one failure would erase the rating forever.
  const keepKnown = (platform, username) => {
    const carried = carryForwardAccount(player, platform, previousSnapshots, username);
    if (carried) accounts[platform] = carried.account;
    return carried ? carried.date : null;
  };

  if (player.chessCom) {
    const username = player.chessCom.toLowerCase();
    try {
      const result = await fetchChessComStats(username);

      if (result.unavailable) {
        const kept = keepKnown('chess.com', username);
        const carriedExtras = latestChessComExtras(previousSnapshots, player.id);
        if (carriedExtras) chessComExtras = carriedExtras.extras;
        accounts['chess.com'] = accounts['chess.com'] ||
          buildV2Account(username, emptyRatings(), {});
        chessComExtras = chessComExtras || emptyChessComExtras();
        unavailableAccounts.push({
          playerId: player.id,
          name: player.name,
          platform: 'chess.com',
          username,
          kept
        });
        console.warn(`  ⚠️  chess.com (${username}): stats unavailable${kept ? `; kept ${kept} ratings` : '; no prior ratings'}`);
      } else {
        accounts['chess.com'] = buildV2Account(username, result.ratings, result.gamesPlayed);
        chessComExtras = result.extras;
        console.log(`  chess.com (${username}): ${formatRatings(result.ratings)} | ${formatChessComExtras(result.extras)}`);
        if (result.missing) {
          missingAccounts.push({
            playerId: player.id,
            name: player.name,
            platform: 'chess.com',
            username
          });
          console.warn(`  ⚠️  chess.com (${username}): account not found (HTTP 404)`);
        }
      }
    } catch (error) {
      console.error(`  chess.com (${username}): ${error.message}`);
      const kept = keepKnown('chess.com', username);
      accounts['chess.com'] = accounts['chess.com'] ||
        buildV2Account(username, emptyRatings(), {});
      chessComExtras = latestChessComExtras(previousSnapshots, player.id)?.extras ||
        emptyChessComExtras();
      unavailableAccounts.push({
        playerId: player.id,
        name: player.name,
        platform: 'chess.com',
        username,
        kept
      });
    }
  }

  if (player.lichess) {
    try {
      const result = await fetchLichessStats(player.lichess);

      if (result.unavailable) {
        const kept = keepKnown('lichess', player.lichess);
        accounts.lichess = accounts.lichess ||
          buildV2Account(player.lichess, emptyRatings(), {});
        unavailableAccounts.push({
          playerId: player.id,
          name: player.name,
          platform: 'lichess',
          username: player.lichess,
          kept
        });
        console.warn(`  ⚠️  lichess (${player.lichess}): stats unavailable${kept ? `; kept ${kept} ratings` : '; no prior ratings'}`);
      } else {
        accounts.lichess = buildV2Account(player.lichess, result.ratings, result.gamesPlayed);
        console.log(`  lichess (${player.lichess}): ${formatRatings(result.ratings)}`);
        if (result.missing) {
          missingAccounts.push({
            playerId: player.id,
            name: player.name,
            platform: 'lichess',
            username: player.lichess
          });
          console.warn(`  ⚠️  lichess (${player.lichess}): account not found (HTTP 404)`);
        }
      }
    } catch (error) {
      console.error(`  lichess (${player.lichess}): ${error.message}`);
      const kept = keepKnown('lichess', player.lichess);
      accounts.lichess = accounts.lichess ||
        buildV2Account(player.lichess, emptyRatings(), {});
      unavailableAccounts.push({
        playerId: player.id,
        name: player.name,
        platform: 'lichess',
        username: player.lichess,
        kept
      });
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
  const missingAccounts = [];
  const unavailableAccounts = [];

  for (const player of players.players) {
    console.log(`Fetching ${player.name}...`);

    try {
      newSnapshots.push(await buildPlayerSnapshot(
        player,
        today,
        missingAccounts,
        existing.snapshots,
        unavailableAccounts
      ));
    } catch (error) {
      console.error(`  ${player.name}: unexpected failure (${error.message})`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // A missing account is reported, never repaired: the fetcher cannot know
  // whether the member renamed, deleted, or was mistyped, and silently dropping
  // them would make the leaderboard argue with the group chat.
  if (missingAccounts.length > 0) {
    console.warn(`\n⚠️  ${missingAccounts.length} account(s) not found. Nothing was removed.`);
    console.warn('   Fix the handle in data/players.json, or remove the player, then re-run.');
    for (const entry of missingAccounts) {
      console.warn(`   ${entry.playerId} (${entry.name}) · ${entry.platform} · ${entry.username}`);
    }
  }

  if (unavailableAccounts.length > 0) {
    console.warn(`\n⚠️  ${unavailableAccounts.length} account(s) could not be fetched. Kept the last known ratings where available.`);
    for (const entry of unavailableAccounts) {
      console.warn(
        `   ${entry.playerId} (${entry.name}) · ${entry.platform} · ${entry.username}` +
        (entry.kept ? ` · kept ${entry.kept}` : ' · no prior ratings')
      );
    }
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
  fetchChessComStats,
  fetchLichessStats,
  fetchExistingSnapshots,
  isMissingResponse,
  latestAccount,
  carryForwardAccount,
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
