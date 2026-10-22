const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

function fetchChessComRating(username) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.chess.com',
      path: `/pub/player/${username}/stats`,
      method: 'GET',
      headers: { 'User-Agent': 'ChessLeaderboard/1.0' }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Priority: blitz > rapid > bullet > daily
          const rating = json.chess_blitz?.last?.rating ||
                        json.chess_rapid?.last?.rating ||
                        json.chess_bullet?.last?.rating ||
                        json.chess_daily?.last?.rating || null;
          resolve({ username, platform: 'chess.com', rating });
        } catch (e) {
          resolve({ username, platform: 'chess.com', rating: null });
        }
      });
    }).on('error', (e) => {
      console.error(`  chess.com ${username}: ${e.message}`);
      resolve({ username, platform: 'chess.com', rating: null });
    });
  });
}

function fetchLichessRating(username) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'lichess.org',
      path: `/api/user/${username}?profile=true`,
      method: 'GET'
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Priority: blitz > rapid > classical > bullet
          const rating = json.perfs?.blitz?.rating ||
                        json.perfs?.rapid?.rating ||
                        json.perfs?.classical?.rating ||
                        json.perfs?.bullet?.rating || null;
          resolve({ username, platform: 'lichess', rating });
        } catch (e) {
          resolve({ username, platform: 'lichess', rating: null });
        }
      });
    }).on('error', (e) => {
      console.error(`  lichess ${username}: ${e.message}`);
      resolve({ username, platform: 'lichess', rating: null });
    });
  });
}

async function main() {
  console.log('🔄 Fetching chess ratings...\n');
  
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  const today = new Date().toISOString().split('T')[0];

  // Load existing snapshots or start fresh
  let snapshots;
  try {
    snapshots = JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf8'));
  } catch {
    snapshots = { snapshots: [] };
  }

  // Skip if already fetched today
  if (snapshots.snapshots.some(s => s.date === today)) {
    console.log(`✅ Today's data already exists (${today}), skipping.`);
    return;
  }

  const newSnapshots = [];

  for (const player of players.players) {
    console.log(`Fetching ${player.name}...`);
    const ratings = [];

    if (player.chessCom) {
      const result = await fetchChessComRating(player.chessCom.toLowerCase());
      ratings.push(result);
      console.log(`  chess.com: ${result.rating || 'no rating'}`);
    }

    if (player.lichess) {
      const result = await fetchLichessRating(player.lichess);
      ratings.push(result);
      console.log(`  lichess: ${result.rating || 'no rating'}`);
    }

    newSnapshots.push({
      playerId: player.id,
      playerName: player.name,
      date: today,
      ratings
    });

    // Be nice to APIs — small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  snapshots.snapshots.push(...newSnapshots);
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2));
  
  console.log(`\n✅ Added ${newSnapshots.length} snapshots for ${today}`);
  console.log(`📊 Total snapshots: ${snapshots.snapshots.length}`);
}

main().catch(console.error);
