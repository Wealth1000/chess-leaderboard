import { execSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

const dir = '/home/wealth/Projects/Personal/chess-leaderboard-site';

// Initialize git repo
execSync('git init', { cwd: dir });
execSync('git checkout -b main', { cwd: dir });

console.log('Repository initialized');
