const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/snapshots.json');
const PLAYERS_FILE = path.join(__dirname, '../data/players.json');

function fetchChessComRating(username) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.chess.com/pub',
      path: `/player/${username}`,
      method: 'GET',
      headers: { 'User-Agent': 'ChessLeaderboard/1.0' }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const rating = json.players?.standard?.rating || null;
          const date = new Date().toISOString().split('T')[0];
          resolve({ username, platform: 'chess.com', rating, date });
        } catch (e) {
          resolve({ username, platform: 'chess.com', rating: null, date: null });
        }
      });
    }).on('error', reject);
  });
}

function fetchLichessRating(username) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'lichess.org',
      path: `/api/player/${username}`,
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
                        json.perfs?.classical?.rating || null;
          const date = new Date().toISOString().split('T')[0];
          resolve({ username, platform: 'lichess', rating, date });
        } catch (e) {
          resolve({ username, platform: 'lichess', rating: null, date: null });
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🔄 Fetching chess ratings...');
  
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  const snapshots = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  
  const today = new Date().toISOString().split('T')[0];
  
  // Check if we already have today's data
  if (snapshots.snapshots.some(s => s.date === today)) {
    console.log('✅ Today\'s data already exists, skipping.');
    return;
  }

  const newSnapshots = [];
  
  for (const player of players.players) {
    const results = [];
    
    if (player.chessCom) {
      const rating = await fetchChessComRating(player.chessCom);
      results.push(rating);
    }
    
    if (player.lichess) {
      const rating = await fetchLichessRating(player.lichess);
      results.push(rating);
    }
    
    newSnapshots.push({
      playerId: player.id,
      playerName: player.name,
      date: today,
      ratings: results
    });
    
    // Small delay to be nice to APIs
    await new Promise(r => setTimeout(r, 500));
  }

  snapshots.snapshots.push(...newSnapshots);
  fs.writeFileSync(DATA_FILE, JSON.stringify(snapshots, null, 2));
  
  console.log(`✅ Added ${newSnapshots.length} player snapshots for ${today}`);
  console.log(`📊 Total snapshots: ${snapshots.snapshots.length}`);
}

main().catch(console.error);
