/**
 * The host-side loader — the ONLY Doorway code that runs in the platform's page.
 *
 * It holds no state, reads no storage and makes no network call of its own. It
 * mounts the Door (a sandboxed, cross-origin iframe on the Doorway origin) when
 * the platform decides a trigger fired, and removes it when told it has settled.
 *
 * Host -> door   { trigger: true, type }      type is the trigger KIND, never the query
 * Door -> host   { ready: true } | { settled: true }
 *
 * Inherent residual (see docs/02 R9): the host knows it decided to trigger, and a
 * host can always decline to mount the frame, or render a fake card of its own.
 */

import { parseLabs, previewShape, waveSeconds } from './labs.js';

export const DEFAULT_TIMEOUT_MS = 5000;

const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox';
// Labs only: quick exit needs the Door to navigate the host page, but only on a real click or Enter
// (user activation). Granted ONLY when the platform opted in with data-labs="quick-exit"; the shipped
// sandbox above is unchanged.
const QUICK_EXIT_TOKEN = 'allow-top-navigation-by-user-activation';
// allow-same-origin is safe here and required: the frame is cross-origin to the
// host, so the host still cannot reach in, and without it the Door would get an
// opaque origin — no localStorage, and `Origin: null` on every request.

export function doorUrl(doorOrigin, { install, country, legalJurisdiction, labs = [], waveSeconds: ws, preview } = {}) {
  const u = new URL('/v1/', doorOrigin);
  u.searchParams.set('i', install);
  if (/^[A-Za-z]{2}$/.test(country || '')) u.searchParams.set('c', country.toUpperCase());
  if (/^[A-Za-z]{2}$/.test(legalJurisdiction || '')) u.searchParams.set('j', legalJurisdiction.toUpperCase());
  if (labs.length) {
    u.searchParams.set('x', labs.join(','));
    if (ws) u.searchParams.set('ws', String(waveSeconds(ws)));
    const p = previewShape(preview, labs);
    if (p) u.searchParams.set('p', p);
  }
  return u.toString();
}

/** One-line, installer-facing fixes. Shown in the console; never sent anywhere. */
export const INSTALL_HINTS = Object.freeze({
  'missing-install': 'Doorway: no install id. Add data-install="inst_xxxxxx" to the script tag.',
  'bad-install': 'Doorway: the install id looks wrong. It should look like inst_ followed by 6+ lowercase letters or digits.',
  'unknown-install': 'Doorway: this install id is not registered. Check it against the one you were given.',
  'unverified': 'Doorway: this install has not been verified yet. Place your verification token in a <meta name="doorway-verify"> tag, then verify.',
  'blocked': 'Doorway: the Door did not start. Likely causes: wrong install id, an unverified or different domain, or your Content-Security-Policy blocks frame-src for the Doorway origin.',
});

export function createLoader({
  doc = document, win = window, doorOrigin, install, country, legalJurisdiction, labs: labsRaw, waveSeconds: waveRaw,
  timeoutMs = DEFAULT_TIMEOUT_MS, log = (m) => console.error(m), fetchImpl = win.fetch?.bind(win),
} = {}) {
  let doorOriginUrl;
  try { doorOriginUrl = new URL(doorOrigin); } catch { throw new Error(`Doorway: doorOrigin is not a valid URL: ${doorOrigin}`); }
  const doorOriginStr = doorOriginUrl.origin;
  let current = null;
  const labs = parseLabs(Array.isArray(labsRaw) ? labsRaw.join(',') : labsRaw);

  const problem = !install ? 'missing-install' : !/^inst_[a-z0-9]{6,}$/.test(install) ? 'bad-install' : null;
  if (problem) log(INSTALL_HINTS[problem]);

  /** @returns {Promise<void>} resolves when the overlay has settled; carries no data. */
  function trigger(type = 'search', opts = {}) {
    if (problem) return Promise.resolve();
    if (current) return current.promise;
    const t = ['search', 'chat', 'nav', 'navigation'].includes(type) ? type : 'search';

    const prevFocus = doc.activeElement;
    const iframe = doc.createElement('iframe');
    iframe.src = doorUrl(doorOrigin, { install, country: opts.country ?? country, legalJurisdiction, labs, waveSeconds: waveRaw, preview: opts.preview });
    iframe.setAttribute('sandbox', labs.includes('quick-exit') ? SANDBOX + ' ' + QUICK_EXIT_TOKEN : SANDBOX);
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('title', 'Help');
    iframe.setAttribute('allow', 'clipboard-write'); // only so the "copy this sentence" button works
    // Hidden until the Door says it is ready: a broken install must never leave
    // an invisible full-screen layer over the platform's page.
    iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483647;' +
      'background:transparent;color-scheme:normal;visibility:hidden';

    let done;
    const promise = new Promise((r) => { done = r; });
    let timer = null;

    const cleanup = () => {
      win.removeEventListener('message', onMessage);
      clearTimeout(timer);
      iframe.remove();
      try { prevFocus?.focus?.(); } catch { /* element gone */ }
      current = null;
      done();
    };

    function onMessage(e) {
      if (e.origin !== doorOriginStr || e.source !== iframe.contentWindow) return;
      const d = e.data;
      if (!d || typeof d !== 'object' || Object.keys(d).length !== 1) return;
      if (d.ready === true) { clearTimeout(timer); iframe.style.visibility = 'visible'; iframe.focus(); }
      else if (d.settled === true) cleanup();
    }

    iframe.addEventListener('load', () => {
      // A Door that failed to start (error page, blocked frame) has another origin;
      // the browser refuses the message and the timeout below reports the fix.
      try { iframe.contentWindow?.postMessage({ trigger: true, type: t }, doorOriginStr); } catch { /* handled by the start timeout */ }
    });
    win.addEventListener('message', onMessage);
    doc.body.appendChild(iframe);

    timer = setTimeout(async () => {
      log(INSTALL_HINTS.blocked);
      try {
        const r = await fetchImpl?.(new URL(`/v1/status?i=${encodeURIComponent(install)}`, doorOriginStr), { credentials: 'omit', referrerPolicy: 'no-referrer' });
        const s = await r?.json();
        if (s && s.ok === false && INSTALL_HINTS[s.reason]) log(INSTALL_HINTS[s.reason]);
      } catch { /* diagnostics only */ }
      cleanup();
    }, timeoutMs);

    current = { promise };
    return promise;
  }

  return { trigger };
}
