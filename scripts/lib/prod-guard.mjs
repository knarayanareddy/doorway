/**
 * Production key guard (security review item 1). Pure: no file or network I/O.
 *
 * The routes bundle is verified against the public key pinned in
 * packages/doorway/src/pubkey.js. While that pin is the DEV key, anyone with the
 * dev private key (generated on a developer machine, kept in .keys/) can sign a
 * routes bundle the production Door would accept. A production build must refuse
 * that pin.
 */
import crypto from 'node:crypto';

/**
 * SHA-256 (hex) of the raw 32-byte Ed25519 public key that pubkey.js pinned while
 * it was the dev key. Computed from the public half only; no private material.
 * Keep this list when the pin changes: the dev key stays listed forever, so a
 * later revert to it is still refused.
 */
export const DEV_KEY_FINGERPRINT = Object.freeze([
  '723fcb794590fad6bf7763f73288d5da616dc6cf7424e50af0be9b5cb879c5c3',
  'eeffa57532144adefee0fff45da63930593d634c09405859c1b70ec8c023e74e',
]);

/** SHA-256 (hex) of a raw base64url Ed25519 public key. */
export function fingerprintOf(publicKeyB64u) {
  return crypto.createHash('sha256').update(Buffer.from(String(publicKeyB64u), 'base64url')).digest('hex');
}

export function isDevKey(publicKeyB64u) {
  return DEV_KEY_FINGERPRINT.includes(fingerprintOf(publicKeyB64u));
}

/** Throws when a production build pins a known dev key. Otherwise returns undefined. */
export function assertProductionKey({ publicKey, isProductionBuild }) {
  if (isProductionBuild === true && isDevKey(publicKey)) {
    throw new Error(
      `refusing a production build: packages/doorway/src/pubkey.js pins the DEV key (fingerprint ${fingerprintOf(publicKey)}). ` +
        'Generate a production key with scripts/gen-prod-key.mjs, pin it, and sign with it.',
    );
  }
}

/** The check's outcome for a pinned key and an environment. `ok: false` means exit 1. */
export function evaluateProdKey({ publicKey, env }) {
  const production = env?.DOORWAY_PRODUCTION === '1';
  if (isDevKey(publicKey)) {
    if (production) return { ok: false, note: 'dev key pinned: refused for DOORWAY_PRODUCTION=1' };
    return { ok: true, note: 'PASS dev key pinned: fine for demos, refused for DOORWAY_PRODUCTION=1' };
  }
  return { ok: true, note: `PASS production key pinned (fingerprint ${fingerprintOf(publicKey).slice(0, 16)}…)` };
}
