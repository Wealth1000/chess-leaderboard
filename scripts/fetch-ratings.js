const https = require('https');
const fs = require('fs');
const path = require('path');

const GIST_ID = process.env.GIST_ID;
const GIST_TOKEN = process.env.GIST_TOKEN;
const PLAYERS_FILE = path.join(__dirname, '../data/players.json');

if (!GIST_ID || !GIST_TOKEN) {
  console.error('Missing GIST_ID or GIST_TOKEN environment variables');
  process.exit(1);
}

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

function updateGist(snapshots) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ files: { 'snapshots.json': { content: JSON.stringify(snapshots, null, 2) } } });
    
    const options = {
      hostname: 'api.github.com',
      path: `/gists/${GIST_ID}`,
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'User-Agent': 'ChessLeaderboard/1.0',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
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
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔄 Fetching chess ratings...\n');
  
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  const today = new Date().toISOString().split('T')[0];

  // Fetch current gist data
  let snapshots = { snapshots: [] };
  try {
    const gistRes = await new Promise((resolve, reject) => {
      https.get({
        hostname: 'api.github.com',
        path: `/gists/${GIST_ID}`,
        headers: { 'User-Agent': 'ChessLeaderboard/1.0' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    
    const snapshotFile = gistRes.files?.['snapshots.json'];
    if (snapshotFile) {
      snapshots = JSON.parse(snapshotFile.content);
    }
  } catch (e) {
    console.log('No existing gist data, starting fresh');
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
      console.log(`  chess.com: ${result.rating ?? 'N/A'}`);
    }

    if (player.lichess) {
      const result = await fetchLichessRating(player.lichess);
      ratings.push(result);
      console.log(`  lichess: ${result.rating ?? 'N/A'}`);
    }

    newSnapshots.push({
      playerId: player.id,
      playerName: player.name,
      date: today,
      ratings
    });

    await new Promise(r => setTimeout(r, 200));
  }

  snapshots.snapshots.push(...newSnapshots);
  
  console.log(`\n✅ Added ${newSnapshots.length} snapshots for ${today}`);
  console.log(`📊 Total snapshots: ${snapshots.snapshots.length}`);
  
  await updateGist(snapshots);
}

main().catch(console.error);
