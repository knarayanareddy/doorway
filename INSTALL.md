# Installing Doorway

Doorway is the **response layer**: when your platform decides a search or message needs a warning, Doorway shows it and routes the person to help. It does not detect anything and never receives what was typed. See `docs/08-trigger-adapters.md` for where a trigger comes from.

**Status.** The install path is built and tested locally. Nothing is deployed to Cloudflare yet, and no real platform has installed it. The local demo below runs the real Door and the real Desk on your machine.

## Quickstart

1. Get an install id (`inst_xxxxxx`) and a Desk token from whoever runs the edge. Installs are registered by the operator, not self-service (`BUILD.md`, "Deploying the edge").
2. Build the loader for that edge: `npm ci`, then `DOOR_ORIGIN=https://door.example.org CDN_BASE=https://cdn.example.org npm run build`. The build prints the `<script>` tag with the real URL and SRI hash, and writes `dist/v<version>/manifest.json`.
3. Paste the tag into your page, with `data-install="inst_xxxxxx"` (section 1). Serve the loader from a host that sends `Access-Control-Allow-Origin: *`.
4. Fire one event from your platform: `document.dispatchEvent(new CustomEvent('doorway:flag', { detail: { type: 'search' } }))`. To test with no platform code, run `window.doorway.trigger('search')` in the console.
5. Verify the install: add `<meta name="doorway-verify" content="TOKEN">` to the page head, then `curl -X POST https://door.example.org/v1/verify -H 'content-type: application/json' -d '{"i":"inst_xxxxxx"}'` (section 5).
6. Open `https://door.example.org/desk`, enter the install id and Desk token. Your count should read 1 (section 7; cells under 10 are hidden, so a count of 1 may show as hidden).

**Try it on your machine first (no edge deployment needed):**

```bash
npm ci
npm run demo:app    # the real Door on http://127.0.0.1:8788, the app at http://127.0.0.1:8789/app/
```

Then open `http://127.0.0.1:8788/desk`, install `inst_demo001`, Desk token `desk-demo-token`. That token is public on purpose: never use it for a real install.

## What you do NOT have to do

- **Write JavaScript beyond one event.** The script tag does the rest (section 1).
- **Send search text, messages or any user data.** Doorway is told the trigger kind (`search`, `chat` or `nav`) and nothing else. Your platform does not pass the query.
- **Supply or maintain a term list.** Doorway ships none. Keeping your own trigger source current is your job (`docs/08`).
- **Run a server, a database or a counter.** The edge is run by the operator. Your page only loads the loader.
- **Write legal or confidentiality wording.** Until a reviewed record exists for your declared jurisdiction, visitors see neutral copy. Legal wording is not something this install can supply (`docs/04` V12).
- **Get a DPIA, a data-processing agreement or counsel sign-off from Doorway.** Those are yours or the pilot's to obtain (`docs/03`).
- **Set a cookie.** The source sets none, and the privacy gate fails on cookie use. The Door keeps its own small state in `localStorage` on the visitor's device.

## Time to install

**Target: under 15 minutes** for a person who is not a developer, from step 1 of the quickstart (with the install id and token in hand) to a Desk count of one. The target comes from the build blueprint. It is a goal, not a measurement.

**Measured so far: none by a non-developer.** The only install runs were by developers, on the Maritime sandbox (`docs/14`) and in the local demo.

To measure it, run the stopwatch protocol:

```bash
node scripts/measure-install.mjs --out timings.jsonl
```

The script runs the protocol below, asks the checks, prints the verdict and appends one JSON line per attempt. It records no names and no install ids.

- **Participant.** Has not written code professionally in the last two years. Given only this file, the install id and the Desk token, prepared in advance.
- **GO.** The timer starts when the participant begins step 1. Press Enter at that moment.
- **During.** The developer does not type, paste, point or explain. Mistakes are recorded, not fixed.
- **DONE.** The participant says the Desk shows their count. Press Enter. The timer stops. Answer the checks afterwards.
- **Pass.** Under 15 minutes, no help, a visible trigger response, and a Desk count that rose by one.
- **Report every attempt**, including failures. One attempt is n = 1 and is not a rate.

Until a non-developer has passed, say "the install target is under 15 minutes; not yet measured" wherever you describe the install.

## 1. Script tag (no JavaScript to write)

```html
<script src="https://cdn.example.org/v0.2.0/doorway.min.js"
        integrity="sha384-…"
        crossorigin="anonymous"
        data-install="inst_xxxxxx"
        data-trigger-event="doorway:flag"
        data-country="NL"
        data-legal-jurisdiction="NL"
        defer></script>
```

`npm run build` prints this tag with the real URL and SRI hash filled in (`dist/v<version>/manifest.json`). The URL is versioned and immutable: a new release is a new URL. Without `CDN_BASE` and `DOOR_ORIGIN` the build uses placeholder origins (`cdn.doorway.example`, `door.doorway.example`), so set both for a real install.

Whatever your platform uses to flag a search then fires one event, passing the trigger **kind** (`search`, `chat` or `nav`), never the query:

```js
document.dispatchEvent(new CustomEvent('doorway:flag', { detail: { type: 'search' } }));
// or, equivalently:  window.doorway.trigger('search')
```

| Attribute | Required | Meaning |
|---|---|---|
| `data-install` | yes | Your install id. |
| `data-trigger-event` | no | The document event that opens the Door. |
| `data-country` | no | Two letters. Filters which help service is offered; never overrides language. |
| `data-legal-jurisdiction` | no | Two letters. Only shows a legal statement if a *reviewed* record exists for it. Never inferred. Leave empty otherwise. |

The Door origin is fixed when the loader is built (`DOOR_ORIGIN` in `npm run build`). No attribute can change it.

**Whoever serves `doorway.min.js` must send `Access-Control-Allow-Origin: *`.** With `integrity` and `crossorigin="anonymous"` the browser fetches the file with CORS, and without that header it blocks the script silently apart from a console error. Most CDNs and object stores need CORS switched on explicitly; check with `curl -sI <url> | grep -i access-control`. Self-hosting on your own domain avoids it, because the request is then same-origin.

## 2. WordPress

`npm run build` generates `dist/wordpress/doorway/doorway.php` with the SRI hash filled in. Upload it as a plugin, activate it, then **Settings > Doorway** and paste your install id. Your moderation plugin fires `doorway:flag`. *Run in a real WordPress 7.1.4 in Chromium, Firefox and WebKit (`docs/09-cms-verification.md`). Not tried on a hosted WordPress or with a caching plugin.*

## 3. Discourse

Create a theme component (Admin, Customize, Themes, Install, Create new, type Component), paste the contents of `dist/discourse/common/head_tag.html` into its **Common, `</head>`** field with your install id, and add the component to your active theme. If the loader is not on your own domain, its host must send `Access-Control-Allow-Origin: *` (see above). *Run once, in a Maritime sandbox with Discourse's own installer and its Content-Security-Policy on, in Chromium only (`docs/14`). Not yet run on a production Discourse.*

## 4. UNICRI plug-in contract

If your platform already dispatches `sbis:trigger` on `document.body`, the script tag listens for it with no extra code. The `sbis:result` you get back says the overlay settled; its `outcome` is always `"continued"` and `helpServiceId` is null. That is deliberate: your page is treated as untrusted, and what the person did must not reach it (`docs/02` R9).

## 5. Make your install writable

An install counts events only after it is verified:

1. Put `<meta name="doorway-verify" content="YOUR-TOKEN">` in your page head, or a DNS TXT record at `_doorway.your-domain` containing the token.
2. `curl -X POST https://door.example.org/v1/verify -H 'content-type: application/json' -d '{"i":"inst_xxxxxx"}'`

The Door will only load on the exact domain registered for the install (`frame-ancestors`).

## 6. Troubleshooting (also printed in the browser console)

| You see | Cause | Fix |
|---|---|---|
| `no install id` | missing `data-install` | add `data-install="inst_xxxxxx"` |
| `install id looks wrong` | typo | it is `inst_` plus 6+ lowercase letters or digits |
| `not registered` | wrong id | check the id you were given |
| `not been verified yet` | step 5 not done | add the meta tag or DNS record, then call verify |
| `the Door did not start` | wrong or different domain, or your CSP blocks it | embed only on the registered domain; allow the Door origin in `frame-src` |
| Nothing at all | your platform never fired the event | call `window.doorway.trigger('search')` from your console to test |

## 7. The numbers

`https://door.example.org/desk` — enter your install id and Desk token. Every figure is labelled *self-reported by the install's page, unauthenticated*; cells under 10 are hidden. The Desk also shows how many events the Door could not send, and a form to report a mistaken warning (no search text, no time finer than a day).

The Desk also breaks the same counts down by trigger (search, chat, navigation), by help route (a route shown as *no route shown* means the warning offered no link), by escalation step (1 to 5 or more), and by control wording. The control wording is the copy that offers the way out, not a group that saw no warning. It has a one-page adoption ladder that ticks only what the counts prove. Two rungs (routes current, Glass Door audited) are listed as not measured by the Desk.

The Desk has no hour-of-day view and no badge for a level. A "what this dashboard cannot tell you" box says what the counts can not show.

## 8. Running your own edge

See `BUILD.md` → *Deploying the edge*. Nothing has been deployed to Cloudflare yet: the Worker has run locally on `node:sqlite` and on workerd with a local D1 (`docs/07`, "Edge not deployed").
