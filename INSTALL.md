# Installing and Integrating Doorway

Doorway provides plug-and-play CSAM prevention and help routing for platforms (forums, search engines, image boards). It records zero personal data, performs no tracking, and uses client-side state machines.

---

## 1. Quickstart Drop-in (Under 3 Minutes)

Add this module to your search or forum page:

```html
<script type="module">
  import { createDoorway } from './packages/doorway/src/widget.js';
  import routes from './packages/doorway/src/routes.nl.json' with { type: 'json' };

  // Initialize the widget
  const doorway = createDoorway({
    routes,
    endpoint: {
      url: 'https://edge.yourdomain.com/v1/c',
      install: 'inst_your_platform_id',
    },
    lang: navigator.language || 'en',
  });

  // Attach to your search form
  const form = document.getElementById('search-form');
  form.addEventListener('submit', (e) => {
    const input = document.getElementById('search-input');
    if (isTriggerTerm(input.value)) {
      e.preventDefault();
      doorway.trigger({ type: 'search' });
    }
  });
</script>
```

---

## 2. Integrating with the Plug-in Contract (`sbis:trigger`)

If your platform uses the UNICRI plug-in contract (`contract/PLUGIN_CONTRACT.md`):

```html
<script type="module">
  import { createDoorway } from './packages/doorway/src/widget.js';
  import { attach } from './packages/doorway/src/sbis-adapter.js';
  import routes from './packages/doorway/src/routes.nl.json' with { type: 'json' };

  const doorway = createDoorway({ routes });
  attach({ doc: document, doorway, routes });
</script>
```

Your backend or client simply dispatches `sbis:trigger` when a matched pattern is detected:

```javascript
document.body.dispatchEvent(new CustomEvent('sbis:trigger', {
  detail: {
    type: 'search',
    severity: 'high',
    country: 'NL',
    language: 'nl',
    timestamp: new Date().toISOString()
  }
}));
```

---

## 3. Deploying the Anonymous Edge Counter

The counter endpoint runs on Cloudflare Workers with a D1 SQLite database:

```bash
cd edge
wrangler d1 execute doorway-db --file=schema.sql
wrangler deploy
```

The edge worker validates the strict eight-field payload (`i, v, f, t, o, r, e, b`), strips client connection metadata, and increments daily coarsened aggregates with write-time k-anonymity.

---

## 4. Repository Layout & Architecture

To navigate this repository:

* **Production Packages:**
  * `packages/core/`: Deterministic, pure algorithms (`shift.js` state machine, `route.js` honest directory lookup, `counter.js` whitelist validator). Zero external dependencies.
  * `packages/doorway/`: Shadow DOM user interface (`widget.js`), event adapter (`sbis-adapter.js`), and verified routes bundle (`routes.nl.json`).
  * `packages/shared/`: Shared decision surface (`card.js`), accessibility controls (`a11y.js`), and metrics validation (`validate.js`, `loop.js`).
  * `edge/`: Cloudflare Worker (`c.js`) and D1 database schema (`schema.sql`).
* **Specifications & Research (Reference Material):**
  * `DOORWAY-blueprint.html`: Complete theoretical system specification (83 KB).
  * `research/`: Literature reviews and academic evaluations of warning efficacy (Ahmia, Google, ReDirection).
  * `docs/`: Threat model (`02-threat-model.md`), product gap analysis (`03-the-gap-to-real.md`), and verification ledgers (`04-open-verifications.md`).
  * `organiser/`: Upstream UNICRI hackathon challenge kit and test fixtures.
