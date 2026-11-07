import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateProdKey, REPO_ROOT } from '../gen-prod-key.mjs';
import { verifyBundle, signedBytes, bytesToB64u } from '../../packages/core/src/bundle.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'doorway-genkey-'));

test('the private key file is created with mode 0600', () => {
  const file = path.join(tmp(), 'routes.pem');
  generateProdKey({ file });
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('the output holds the public key and no private material', () => {
  const file = path.join(tmp(), 'routes.pem');
  const { text, publicKeyB64u } = generateProdKey({ file });
  const pem = fs.readFileSync(file, 'utf8');
  const header = pem.split('\n')[0];
  assert.ok(header.startsWith('-----BEGIN') && header.endsWith('-----'), 'the file really is a PEM key');
  assert.ok(!text.includes(header), 'the PEM header is not printed');
  for (const line of pem.split('\n').filter((l) => /^[A-Za-z0-9+/=]{20,}$/.test(l))) {
    assert.ok(!text.includes(line), 'no line of the PEM body is printed');
  }
  const seed = crypto.createPrivateKey(pem).export({ type: 'pkcs8', format: 'der' }).subarray(-32);
  assert.ok(!text.includes(bytesToB64u(seed)), 'the raw private seed is not printed');
  assert.ok(text.includes(`export const PUBLIC_KEY_RAW_B64U = '${publicKeyB64u}';`), 'the line pubkey.js expects is printed');
  assert.ok(text.includes(`export const KEY_ID = 'prod-`));
  assert.equal(Buffer.from(publicKeyB64u, 'base64url').length, 32);
});

test('the printed public key verifies a bundle signed with the written private key', async () => {
  const file = path.join(tmp(), 'routes.pem');
  const { publicKeyB64u } = generateProdKey({ file });
  const bundle = { version: '1', validUntil: '2030-01-01T00:00:00Z', byLanguage: {} };
  bundle.sig = bytesToB64u(new Uint8Array(crypto.sign(null, signedBytes(bundle), crypto.createPrivateKey(fs.readFileSync(file)))));
  const pub = Uint8Array.from(Buffer.from(publicKeyB64u, 'base64url'));
  assert.equal((await verifyBundle(bundle, pub)).ok, true);
});

test('refuses a relative path', () => {
  assert.throws(() => generateProdKey({ file: 'routes.pem' }), /absolute/);
});

test('refuses a path inside the repository working tree, and writes nothing', () => {
  const file = path.join(REPO_ROOT, 'gen-prod-key-should-not-exist.pem');
  assert.throws(() => generateProdKey({ file }), /inside the repository/);
  assert.equal(fs.existsSync(file), false);
});

test('refuses a symlinked directory that points into the repository', () => {
  const link = path.join(tmp(), 'link');
  fs.symlinkSync(REPO_ROOT, link);
  assert.throws(() => generateProdKey({ file: path.join(link, 'routes.pem') }), /inside the repository/);
  assert.equal(fs.existsSync(path.join(REPO_ROOT, 'routes.pem')), false);
});

test('refuses to overwrite an existing file', () => {
  const file = path.join(tmp(), 'routes.pem');
  generateProdKey({ file });
  const before = fs.readFileSync(file, 'utf8');
  assert.throws(() => generateProdKey({ file }), /overwrite/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('refuses a directory that does not exist', () => {
  assert.throws(() => generateProdKey({ file: path.join(tmp(), 'missing', 'routes.pem') }), /does not exist/);
});
