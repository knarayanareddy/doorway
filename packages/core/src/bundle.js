/**
 * Signed routes bundle (review B4).
 *
 * The platform serves the page, so the platform — or whoever compromises it —
 * could change where the primary button goes. The bundle is therefore signed
 * with Ed25519; the public key is pinned in the Door, which loads from the
 * Doorway origin (see B1). Verification uses WebCrypto and runs before any
 * route is used.
 *
 * Pure apart from `subtle`, which is injected so Node tests and browsers share
 * the same code.
 */
import { dropDisallowed } from './route.js';

/** Deterministic JSON: object keys sorted at every depth, no whitespace. */
export function canonicalize(v) {
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

export const signedBytes = (bundle) => {
  const { sig: _sig, ...rest } = bundle;
  return new TextEncoder().encode(canonicalize(rest));
};

const b64uToBytes = (s) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
export const bytesToB64u = (u8) =>
  btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * @returns {Promise<{ok:true, bundle:object} | {ok:false, reason:string}>}
 * On failure the caller falls back to neutral copy with no link, or to the
 * embedded last-known-good bundle — never to the unverified one.
 */
export async function verifyBundle(bundle, publicKeyRaw, { now = Date.now(), subtle = globalThis.crypto?.subtle } = {}) {
  try {
    if (!bundle || typeof bundle.sig !== 'string') return { ok: false, reason: 'unsigned' };
    if (!subtle) return { ok: false, reason: 'no webcrypto' };
    const until = Date.parse(bundle.validUntil);
    if (!Number.isFinite(until)) return { ok: false, reason: 'no validUntil' };
    if (until <= now) return { ok: false, reason: 'expired' };
    const key = await subtle.importKey('raw', publicKeyRaw, { name: 'Ed25519' }, false, ['verify']);
    const good = await subtle.verify({ name: 'Ed25519' }, key, b64uToBytes(bundle.sig), signedBytes(bundle));
    if (!good) return { ok: false, reason: 'bad signature' };
    return { ok: true, bundle: dropDisallowed(bundle) };
  } catch (e) {
    return { ok: false, reason: 'verify error: ' + (e?.message || e) };
  }
}
