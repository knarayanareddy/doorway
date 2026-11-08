#!/usr/bin/env node
/* eslint-disable no-restricted-syntax */
/**
 * Provision a new install (R8). Generates ids, tokens, hash and the wrangler command.
 *
 *   node scripts/provision-install.mjs --domain platform.example [--traffic 5000] [--remote] [--disabled]
 *
 * --domain   exact host (no scheme, no wildcard) — required
 * --traffic  expected accepted events per day (sets daily_cap); default 5000
 * --remote   actually run `npx wrangler d1 execute ... --remote` after printing (requires confirmation)
 * --disabled create with daily_cap=0 (disabled) — requires --disabled flag, otherwise 0 is refused
 *
 * Prints the verify token, desk token (once), hash, SQL and the install URL to verify.
 * The desk token is shown once; the edge stores only the hash.
 */
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function randHex(bytes) { return crypto.randomBytes(bytes).toString('hex'); }
function randId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'inst_';
  const b = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) s += chars[b[i] % chars.length];
  return s;
}
function randB64Url(bytes) { return crypto.randomBytes(bytes).toString('base64url'); }
function sha256hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

const args = process.argv.slice(2);
const get = (name) => {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return null;
  if (args[i].includes('=')) return args[i].split('=')[1];
  return args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
};
const has = (name) => args.includes(`--${name}`);

if (has('help') || !get('domain')) {
  console.error('usage: node scripts/provision-install.mjs --domain platform.example [--traffic 5000] [--remote] [--disabled]');
  process.exit(2);
}
const domain = String(get('domain')).trim();
if (!/^[a-z0-9.-]+(:\d+)?$/i.test(domain) || domain.includes('/') || domain.includes(' ')) {
  console.error(`domain must be an exact host (no scheme, no wildcard), got "${domain}"`);
  process.exit(1);
}
if (domain.includes('*.') || domain.startsWith('.')) {
  console.error('wildcards and leading dots are not allowed');
  process.exit(1);
}
const trafficRaw = get('traffic');
let dailyCap = 5000;
if (trafficRaw != null && trafficRaw !== true) {
  dailyCap = Number(trafficRaw);
  if (!Number.isInteger(dailyCap) || dailyCap < 0) {
    console.error('traffic must be a non-negative integer (events per day, 0 = disabled with --disabled)');
    process.exit(1);
  }
  if (dailyCap === 0 && !has('disabled')) {
    console.error('daily_cap 0 means disabled (all events rejected). Pass --disabled to create a disabled install, or use a positive cap.');
    process.exit(1);
  }
}

const id = randId();
const verifyToken = randHex(24);
const deskToken = randB64Url(32);
const hash = sha256hex(deskToken);
const ratePerMin = 120;

console.log(`Install ${id} for ${domain}`);
console.log(`  verify_token: ${verifyToken}`);
console.log(`  desk_token:   ${deskToken}   (store this — it is shown once; the edge keeps only the hash)`);
console.log(`  desk_token_hash: ${hash}`);
console.log(`  daily_cap: ${dailyCap}   rate_per_min: ${ratePerMin}`);
console.log('');
console.log('SQL (run with wrangler d1 execute):');
const sql = `INSERT INTO installs (id, domain, verify_token, desk_token_hash, daily_cap, rate_per_min) VALUES ('${id}', '${domain}', '${verifyToken}', '${hash}', ${dailyCap}, ${ratePerMin});`;
console.log(sql);
console.log('');
console.log(`wrangler command:\n  npx wrangler d1 execute doorway-agg --file=- --remote <<'SQL'\n  ${sql}\n  SQL`);
console.log('');
console.log('Installer steps:');
console.log(`  1. Add to the platform's <head>: <meta name="doorway-verify" content="${verifyToken}">`);
console.log(`     (order of attributes does not matter; exact content match)`);
console.log(`     Or DNS TXT: _doorway.${domain}  TXT  "${verifyToken}"`);
console.log(`  2. POST /v1/verify {"i":"${id}"} — or the Desk will trigger it`);
console.log(`  3. Check: curl https://door.example.org/v1/status?i=${id}  → {ok:true} when verified`);
console.log(`     (if daily_cap 0, status returns {ok:false, reason:"disabled"})`);
console.log('');
console.log(`Desk login: id=${id} token=${deskToken}`);

if (has('remote')) {
  console.log('\n--remote: executing via wrangler...');
  const wr = spawnSync('npx', ['wrangler', 'd1', 'execute', 'doorway-agg', '--command', sql, '--remote'], { cwd: ROOT, stdio: 'inherit' });
  process.exit(wr.status ?? 1);
}
