import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { canonicalize, signedBytes, verifyBundle, bytesToB64u } from '../../core/src/bundle.js';
import { PUBLIC_KEY_RAW_B64U } from '../src/pubkey.js';

const shipped = JSON.parse(fs.readFileSync(new URL('../src/routes.nl.json', import.meta.url)));
const b64u = (s) => Uint8Array.from(Buffer.from(s, 'base64url'));
const PUB = b64u(PUBLIC_KEY_RAW_B64U);

function fresh(over = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  const bundle = { version: '1', validUntil: '2030-01-01T00:00:00Z', byLanguage: { nl: { default: { id: 'a', url: 'https://offlimits.nl/' }, alternatives: [] } }, ...over };
  bundle.sig = bytesToB64u(new Uint8Array(crypto.sign(null, signedBytes(bundle), privateKey)));
  return { bundle, raw: new Uint8Array(raw) };
}

test('canonical JSON is key-order independent', () => {
  assert.equal(canonicalize({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: 3 } }), canonicalize({ a: { c: 3, d: [2, { x: 2, y: 1 }] }, b: 1 }));
});

test('the shipped bundle verifies against the pinned public key', async () => {
  const r = await verifyBundle(shipped, PUB, { now: Date.parse('2026-11-07') });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.bundle.byLanguage.nl.default.id, 'nl-offlimits');
});

test('a tampered destination fails verification', async () => {
  const t = structuredClone(shipped);
  t.byLanguage.nl.default.url = 'https://offlimits.nl.evil.example/';
  assert.deepEqual(await verifyBundle(t, PUB, { now: Date.parse('2026-11-07') }), { ok: false, reason: 'bad signature' });
});

test('any other edit fails too: a new route, a changed phone number', async () => {
  const added = structuredClone(shipped);
  added.byLanguage.nl.alternatives.push({ id: 'nl-x', url: 'https://offlimits.nl/', channel: 'selfhelp' });
  assert.equal((await verifyBundle(added, PUB, { now: Date.parse('2026-11-07') })).ok, false);
  const phone = structuredClone(shipped);
  phone.byLanguage.nl.default.phone = '0900 0000';
  assert.equal((await verifyBundle(phone, PUB, { now: Date.parse('2026-11-07') })).ok, false);
});

test('an unsigned bundle, the old placeholder, and a bundle signed by another key are all refused', async () => {
  const { sig: _sig, ...unsigned } = shipped;
  assert.equal((await verifyBundle(unsigned, PUB)).reason, 'unsigned');
  assert.equal((await verifyBundle({ ...shipped, sig: 'UNSIGNED-PLACEHOLDER-NEEDS-SIGNING-INFRASTRUCTURE' }, PUB, { now: Date.parse('2026-11-07') })).ok, false);
  const other = fresh();
  assert.equal((await verifyBundle(other.bundle, PUB)).ok, false);
  assert.equal((await verifyBundle(other.bundle, other.raw)).ok, true, 'sanity: the helper really signs');
});

test('an expired bundle is refused', async () => {
  const { bundle, raw } = fresh({ validUntil: '2026-01-01T00:00:00Z' });
  assert.equal((await verifyBundle(bundle, raw, { now: Date.parse('2026-11-07') })).reason, 'expired');
  const missing = fresh({ validUntil: undefined });
  assert.equal((await verifyBundle(missing.bundle, missing.raw)).reason, 'no validUntil');
});

test('a validly signed route outside the host allow-list is still dropped', async () => {
  const { bundle, raw } = fresh({ byLanguage: { nl: { default: { id: 'bad', url: 'https://evil.example/' }, alternatives: [{ id: 'ok', url: 'https://offlimits.nl/' }] } } });
  const r = await verifyBundle(bundle, raw);
  assert.equal(r.ok, true);
  assert.equal(r.bundle.byLanguage.nl.default.id, 'ok');
});
