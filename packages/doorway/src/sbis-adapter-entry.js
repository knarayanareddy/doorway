/**
 * The script tag.
 *
 * `sbis-adapter.js` is the logic; this is the one-line entry the mock platform
 * (or any platform following contract/PLUGIN_CONTRACT.md) actually loads.
 *
 *   <script type="module" src="/packages/doorway/src/sbis-adapter-entry.js"></script>
 *
 * It resolves with no configuration, because a platform integrator who has to
 * read a config reference before they see a warning is a platform integrator who
 * does not install it. Country and language come from the trigger event.
 */
import { attach } from './sbis-adapter.js';
import { createDoorway } from './widget.js';

const routes = await import('./routes.nl.json', { with: { type: 'json' } })
  .then((m) => m.default)
  .catch(() => ({ byLanguage: {} }));

const doorway = createDoorway({ routes });

attach({
  doc: document,
  doorway,
  routes,
  onCounter(payload) {
    // Fire-and-forget, credentials omitted, referrer suppressed. If the
    // endpoint is absent (a pure static install), nothing leaves the page.
    const endpoint = document.currentScript?.dataset?.endpoint;
    if (!endpoint) return;
    try {
      navigator.sendBeacon?.(endpoint, JSON.stringify(payload));
    } catch {
      /* a failed beacon must never break the intervention */
    }
  },
});

console.info('[doorway] adapter ready — listening for sbis:trigger');
