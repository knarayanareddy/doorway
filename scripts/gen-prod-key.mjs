#!/usr/bin/env node
/**
 * Generate the PRODUCTION routes-signing key (security review item 1).
 *
 *   node scripts/gen-prod-key.mjs /absolute/path/outside/the/repo/doorway-routes.pem
 *
 * Writes the PRIVATE key (PKCS#8 PEM) to that path with mode 0600. It refuses a
 * relative path, a path inside this repository's working tree (checked through
 * realpath, so a symlink does not get round it), and an existing file. It prints
 * ONLY the public key, the pubkey.js line to pin, and the steps. It never prints
 * the private key and never edits pubkey.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { bytesToB64u } from '../packages/core/src/bundle.js';

export const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/+$/, '');

/**
 * @param {{file: string, root?: string, now?: Date}} o
 * @returns {{file: string, publicKeyB64u: string, text: string}}
 */
export function generateProdKey({ file, root = REPO_ROOT, now = new Date() }) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) {
    throw new Error('the key path must be absolute and outside the repository');
  }
  const target = path.resolve(file);
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) throw new Error(`the directory does not exist: ${dir}`);
  const realDir = fs.realpathSync(dir);
  const realRoot = fs.realpathSync(root);
  if (realDir === realRoot || realDir.startsWith(realRoot + path.sep)) {
    throw new Error('refusing: that path is inside the repository working tree. Choose a path outside it.');
  }
  if (fs.existsSync(target)) throw new Error(`refusing to overwrite an existing file: ${target}`);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const publicKeyB64u = bytesToB64u(raw);
  // 'wx' fails if anything exists at the path (including a symlink); mode 0600 is re-applied in case umask widened it.
  fs.writeFileSync(target, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  fs.chmodSync(target, 0o600);

  const keyId = `prod-${now.toISOString().slice(0, 10)}`;
  const text = [
    `Production private key written to: ${target} (mode 0600). It is not printed here and is not in the repository.`,
    '',
    'Public key (raw Ed25519, base64url):',
    `  ${publicKeyB64u}`,
    '',
    '1. Pin it. In packages/doorway/src/pubkey.js replace the two export lines with:',
    `   export const PUBLIC_KEY_RAW_B64U = '${publicKeyB64u}';`,
    `   export const KEY_ID = '${keyId}';`,
    '',
    '2. Sign the routes with the production key (the key path comes from the environment, never from the repo):',
    `   DOORWAY_SIGNING_KEY_FILE='${target}' npm run sign`,
    '   npm run check:routes',
    '   Then re-sign the demo bundle with the same key, or door-panel.test.js will fail:',
    `   DOORWAY_SIGNING_KEY_FILE='${target}' node scripts/sign-routes.mjs --file=packages/doorway/src/routes.demo.json`,
    '',
    '3. Prove the build refuses the dev key and accepts this one:',
    '   DOORWAY_PRODUCTION=1 npm run check:prod-key   (must print PASS)',
    '',
    '4. Rotate later: generate a new key at a NEW path, repeat steps 1-3, deploy, then delete the old private',
    '   file. Only the currently pinned key signs; the old one is retired. See SECURITY.md, "Key rotation".',
    '',
  ].join('\n');
  return { file: target, publicKeyB64u, text };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node scripts/gen-prod-key.mjs /absolute/path/outside/the/repo/key.pem');
    process.exit(2);
  }
  try {
    console.log(generateProdKey({ file }).text);
  } catch (e) {
    console.error('✗ ' + e.message);
    process.exit(1);
  }
}
