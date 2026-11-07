import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_KEY_RAW_B64U } from '../../packages/doorway/src/pubkey.js';
import { DEV_KEY_FINGERPRINT, fingerprintOf, isDevKey, assertProductionKey, evaluateProdKey } from '../lib/prod-guard.mjs';
import { bytesToB64u } from '../../packages/core/src/bundle.js';

const freshKey = () => bytesToB64u(new Uint8Array(crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).subarray(-32)));
const CHECK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'check-prod-key.mjs');

test('the stored fingerprint is the SHA-256 of the dev key that pubkey.js pins today', () => {
  assert.ok(DEV_KEY_FINGERPRINT.includes(fingerprintOf(PUBLIC_KEY_RAW_B64U)));
  assert.equal(isDevKey(PUBLIC_KEY_RAW_B64U), true);
});

test('a production build that pins the dev key throws', () => {
  assert.throws(() => assertProductionKey({ publicKey: PUBLIC_KEY_RAW_B64U, isProductionBuild: true }), /DEV key/);
});

test('a non-production build may pin the dev key', () => {
  assert.doesNotThrow(() => assertProductionKey({ publicKey: PUBLIC_KEY_RAW_B64U, isProductionBuild: false }));
  assert.doesNotThrow(() => assertProductionKey({ publicKey: PUBLIC_KEY_RAW_B64U }));
});

test('a production build with a different key passes', () => {
  const prod = freshKey();
  assert.equal(isDevKey(prod), false);
  assert.doesNotThrow(() => assertProductionKey({ publicKey: prod, isProductionBuild: true }));
});

test('evaluateProdKey: dev key is refused only with DOORWAY_PRODUCTION=1', () => {
  const refused = evaluateProdKey({ publicKey: PUBLIC_KEY_RAW_B64U, env: { DOORWAY_PRODUCTION: '1' } });
  assert.equal(refused.ok, false);
  assert.match(refused.note, /refused for DOORWAY_PRODUCTION=1/);
  const demo = evaluateProdKey({ publicKey: PUBLIC_KEY_RAW_B64U, env: {} });
  assert.equal(demo.ok, true);
  assert.equal(demo.note, 'PASS dev key pinned: fine for demos, refused for DOORWAY_PRODUCTION=1');
  assert.equal(evaluateProdKey({ publicKey: PUBLIC_KEY_RAW_B64U, env: { DOORWAY_PRODUCTION: '0' } }).ok, true);
});

test('the CLI exits 1 only when DOORWAY_PRODUCTION=1 and the dev key is pinned', () => {
  const dev = isDevKey(PUBLIC_KEY_RAW_B64U);
  const run = (env) => spawnSync(process.execPath, [CHECK], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  const prod = run({ DOORWAY_PRODUCTION: '1' });
  assert.equal(prod.status, dev ? 1 : 0, prod.stderr + prod.stdout);
  const demo = run({});
  assert.equal(demo.status, 0, demo.stderr);
  assert.match(demo.stdout, dev ? /dev key pinned: fine for demos, refused for DOORWAY_PRODUCTION=1/ : /PASS production key pinned/);
});
