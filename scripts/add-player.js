#!/usr/bin/env node
/**
 * Adds one member to data/players.json for the join workflow.
 *
 * This is the server-side twin of lib/join.ts: the site cannot write to the
 * repository, so a Formspree submission is actioned by running this script
 * from a `workflow_dispatch` job. It applies the same rules as the form —
 * normalized tag, tag not already taken, at least one handle, handles verified
 * against the live APIs, no handle already on the board — because a form is a
 * suggestion, not a trust boundary.
 *
 * It validates fully before touching the file, so a rejected submission leaves
 * data/players.json byte-identical.
 *
 * Usage (env vars, never argv — the workflow passes them from inputs):
 *   WHATSAPP_TAG="Wealth" DISPLAY_NAME="Wealth" CHESS_COM="wealth" \
 *     LICHESS="" node scripts/add-player.js
 */

const fs = require('fs');
const path = require('path');

const PLAYERS_FILE = path.join(__dirname, '../data/players.json');

const DUPLICATE_MESSAGE =
  'Already on the leaderboard — DM ME (Wealth in the group) to change your details.';

const PLATFORM_LABELS = {
  'chess.com': 'Chess.com',
  lichess: 'Lichess'
};

/**
 * Mirror of normalizePlayerId in lib/identity.ts. Plain Node cannot import the
 * TypeScript module, and the test suite asserts the two agree.
 */
function normalizePlayerId(raw) {
  return String(raw == null ? '' : raw)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function handleUrl(platform, username) {
  return platform === 'chess.com'
    ? `https://api.chess.com/pub/player/${encodeURIComponent(username)}`
    : `https://lichess.org/api/user/${encodeURIComponent(username)}`;
}

/**
 * A 404 is the only "this account does not exist". Everything else — 403 from
 * Cloudflare, 429, DNS, timeout — is "could not check", and the two must never
 * be reported as each other.
 */
async function checkHandle(platform, username) {
  let response;

  try {
    response = await fetch(handleUrl(platform, username), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ChessLeaderboard/1.0'
      }
    });
  } catch (error) {
    return { status: 'unverified', detail: error.message };
  }

  if (response.status === 404) return { status: 'missing' };
  if (!response.ok) {
    return { status: 'unverified', detail: `HTTP ${response.status}` };
  }

  let body;

  try {
    body = await response.json();
  } catch {
    return { status: 'unverified', detail: 'invalid JSON response' };
  }

  if (!body || typeof body.username !== 'string' || !body.username) {
    return { status: 'unverified', detail: 'unexpected response' };
  }

  // The API's casing is canonical: "Fifi_Enko", not what was typed.
  return { status: 'ok', username: body.username };
}

function sameHandle(player, platform, username) {
  const existing = platform === 'chess.com' ? player.chessCom : player.lichess;
  return (
    typeof existing === 'string' &&
    existing.toLowerCase() === username.toLowerCase()
  );
}

/**
 * Pure decision function, injected resolver and all, so the rules can be tested
 * without network access. Keep in step with validateSubmission in lib/join.ts.
 */
async function buildPlayer(submission, players, resolve = checkHandle) {
  const errors = [];
  const id = normalizePlayerId(submission.whatsappTag);
  const rawTag = String(submission.whatsappTag || '').trim();
  const displayName = String(submission.name || '').trim() || rawTag;

  if (!id) {
    errors.push({
      field: 'whatsappTag',
      message: 'The WhatsApp tag has no usable characters.'
    });
  } else if (players.some(player => player.id === id)) {
    errors.push({ field: 'whatsappTag', message: DUPLICATE_MESSAGE });
  }

  const typed = {
    'chess.com': String(submission.chessCom || '').trim(),
    lichess: String(submission.lichess || '').trim()
  };

  if (!typed['chess.com'] && !typed.lichess) {
    errors.push({
      field: 'form',
      message: 'At least one of CHESS_COM or LICHESS is required.'
    });
  }

  const checks = { 'chess.com': null, lichess: null };

  for (const platform of ['chess.com', 'lichess']) {
    const username = typed[platform];
    if (!username) continue;

    const check = await resolve(platform, username);
    checks[platform] = check;

    if (check.status === 'missing') {
      errors.push({
        field: platform === 'chess.com' ? 'chessCom' : 'lichess',
        message: `No ${PLATFORM_LABELS[platform]} account with that username.`
      });
    } else if (check.status === 'unverified') {
      errors.push({
        field: platform === 'chess.com' ? 'chessCom' : 'lichess',
        message: `Could not verify ${PLATFORM_LABELS[platform]} (${check.detail || 'request failed'}).`
      });
    } else if (players.some(player => sameHandle(player, platform, check.username))) {
      errors.push({
        field: platform === 'chess.com' ? 'chessCom' : 'lichess',
        message: DUPLICATE_MESSAGE
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const player = { id, name: displayName || id };
  if (checks['chess.com']) player.chessCom = checks['chess.com'].username;
  if (checks.lichess) player.lichess = checks.lichess.username;

  return { ok: true, player };
}

function appendToGitHubEnv(player) {
  if (!process.env.GITHUB_ENV) return;
  fs.appendFileSync(process.env.GITHUB_ENV, `ADDED_PLAYER_ID=${player.id}\n`);
}

function appendToStepSummary(player) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const handles = [
    player.chessCom ? `chess.com: ${player.chessCom}` : null,
    player.lichess ? `lichess: ${player.lichess}` : null
  ].filter(Boolean).join(', ');

  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Added \`${player.id}\`\n\n| field | value |\n| --- | --- |\n` +
      `| id | \`${player.id}\` |\n| name | ${player.name} |\n| handles | ${handles} |\n`
  );
}

async function main() {
  const submission = {
    whatsappTag: process.env.WHATSAPP_TAG || '',
    name: process.env.DISPLAY_NAME || '',
    chessCom: process.env.CHESS_COM || '',
    lichess: process.env.LICHESS || ''
  };

  const document = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
  const players = Array.isArray(document.players) ? document.players : [];

  const result = await buildPlayer(submission, players);

  if (!result.ok) {
    console.error('✖ Submission rejected:');
    for (const error of result.errors) {
      console.error(`   ${error.field}: ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  document.players.push(result.player);
  fs.writeFileSync(PLAYERS_FILE, `${JSON.stringify(document, null, 2)}\n`);

  console.log(`✅ Added ${result.player.id} (${result.player.name})`);
  if (result.player.chessCom) console.log(`   chess.com: ${result.player.chessCom}`);
  if (result.player.lichess) console.log(`   lichess:   ${result.player.lichess}`);
  console.log(`   players.json now holds ${document.players.length} members`);

  appendToGitHubEnv(result.player);
  appendToStepSummary(result.player);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  DUPLICATE_MESSAGE,
  normalizePlayerId,
  buildPlayer,
  checkHandle
};
