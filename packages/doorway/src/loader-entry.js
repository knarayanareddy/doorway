/**
 * The script-tag install (review B5). No JavaScript authored by the installer:
 *
 *   <script src="https://cdn.doorway.example/v0.2.0/doorway.min.js"
 *           integrity="sha384-…" crossorigin="anonymous"
 *           data-install="inst_xxxxxx"
 *           data-trigger-event="doorway:flag"
 *           data-country="NL" data-legal-jurisdiction="NL" defer></script>
 *
 * It also listens for the UNICRI contract's `sbis:trigger`, and exposes
 * window.doorway.trigger(type) for platforms that prefer to call it directly.
 * The platform passes a trigger KIND ('search' | 'chat' | 'nav'), never a query.
 */
import { createLoader } from './loader.js';
import { attach } from './sbis-adapter.js';


const script = document.currentScript;
const ds = script?.dataset || {};

const loader = createLoader({
  doorOrigin: __DOOR_ORIGIN__,
  install: ds.install,
  country: ds.country,
  legalJurisdiction: ds.legalJurisdiction,
});

window.doorway = Object.freeze({ trigger: (type) => loader.trigger(type) });

if (ds.triggerEvent) {
  document.addEventListener(ds.triggerEvent, (e) => loader.trigger(e?.detail?.type));
}

const wire = () => attach({ doc: document, loader });
if (document.body) wire(); else document.addEventListener('DOMContentLoaded', wire);
