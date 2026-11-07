/**
 * The Door entry point — runs inside the sandboxed, cross-origin iframe served
 * from the Doorway origin (review B1). The host page cannot read this realm.
 *
 * Seam with the host (the ONLY thing that crosses the frame boundary):
 *   host -> door   { trigger: true, type: 'search' | 'chat' | 'nav' }
 *   door -> host   { ready: true }     liveness, so a broken install is detectable
 *   door -> host   { settled: true }   the overlay can be removed
 * No outcome, route, variant, format or count ever crosses. Residual, and
 * inherent: the host decided to trigger, and can suppress the frame entirely.
 */
import { createDoorway } from './widget.js';
import { verifyBundle } from '../../core/src/bundle.js';
import { normaliseType } from '../../core/src/counter.js';
import { PUBLIC_KEY_RAW_B64U } from './pubkey.js';
import BUNDLE from './routes.nl.json';

const params = new URLSearchParams(location.search);
const install = params.get('i') || '';
const country = params.get('c') || undefined;
const legalJurisdiction = params.get('j') || undefined;

const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const toHost = (msg) => window.parent.postMessage(msg, '*'); // content-free; frame-ancestors limits who may embed

const ready = (async () => {
  const v = await verifyBundle(BUNDLE, b64u(PUBLIC_KEY_RAW_B64U));
  // A bundle that fails verification (or has expired) yields NO routes: neutral
  // help copy with no link, never an unverified destination.
  return v.ok ? v.bundle : { byLanguage: {} };
})();

let doorway = null;
const open = async (type) => {
  if (!/^inst_[a-z0-9]{6,}$/.test(install)) return toHost({ settled: true });
  const routes = await ready;
  doorway ??= createDoorway({ routes, install, country, legalJurisdiction, onSettled: () => toHost({ settled: true }) });
  doorway.trigger({ type });
  toHost({ ready: true });
};

window.addEventListener('message', (e) => {
  if (e.source !== window.parent) return;
  const d = e.data;
  if (!d || typeof d !== 'object' || Object.keys(d).length !== 2 || d.trigger !== true) return;
  open(normaliseType(d.type));
});
