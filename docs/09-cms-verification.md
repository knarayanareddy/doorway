# What has actually been run, and where

Written so that "tested" never means more than it did.

## Browsers

`npm run e2e` runs the same suite in **Chromium, Firefox and WebKit** (Playwright builds). Running it in three engines found two real defects that Chromium alone hid:

- **Firefox cancelled the outcome request.** The Door told the loader it had settled immediately, the loader removed the iframe, and Firefox cancelled the `fetch` still in flight, so the outcome was silently lost. The Door now settles after the send completes, bounded at 1.5 s so a hung network never keeps a layer over the page (`widget.js`, `SETTLE_MAX_MS`).
- **Initial focus was unreliable in WebKit.** The frame is `visibility:hidden` until the loader reveals it, and an element in a hidden frame cannot take focus. The Door now re-focuses its primary action when the frame is revealed, and never after the person has pressed a key or pointer (`widget.js`).

Two things that looked like Safari bugs were not: Safari does not Tab to buttons by default (the test uses Option+Tab there), and `left_page` appeared to be lost in WebKit only because Playwright's request interception cancels in-flight requests on navigation. Without interception WebKit records it reliably; the abandon record now goes through `sendBeacon` (same endpoint, same validated payload) with a `fetch keepalive` fallback.

**Not covered:** real Safari on macOS or iOS (Playwright's WebKit is not Safari), mobile browsers, and Safari's Intelligent Tracking Prevention in the wild. Third-party `localStorage` in the Door's frame behaves as in Playwright's engines; if a real browser blocks it, the DEGRADED path (card, not gate) applies.

## The Worker

- Unit tests run the real `edge/c.js` and `edge/schema.sql` on `node:sqlite`.
- `npm run smoke:workerd` runs it on **workerd** (the Workers runtime) with a local D1, via `wrangler dev --local`, and checks the write path, the limiter, the CSP headers, the asset binding and the Desk. This found a real deploy-blocker: `wrangler.toml` had `[logpush] enabled = false`, which wrangler rejects (`logpush = false` is correct).
- It has **not** been deployed to Cloudflare, so Cloudflare's D1 service itself, real network edges and real DNS verification are untested.

## WordPress

`npm run verify:wordpress` (`scripts/wp-verify.sh`) builds the plugin, runs `php -l`, installs it into a real **WordPress 7.1.4** on SQLite served by PHP's built-in server, sets the install id with wp-cli, and drives it in all three browsers. Checked: exactly one script tag with the SRI hash, `defer`, `crossorigin`, `data-install`, `data-country` and the trigger event; `window.doorway` exists; a `doorway:flag` event opens the Door and the outcome is counted for that install. Also checked by hand with wp-cli: the settings sanitizers reject malformed input (`"not valid"`, `INST_X`, `inst_<script>`, `NLD`) and no tag is emitted when no install id is set.

**Not covered:** the Settings page rendered in a browser while logged in, a hosted WordPress, page-caching or minifying plugins (a minifier that rewrites the tag would break its SRI hash), multisite.

## Discourse

The generated `head_tag.html` is a single tag in the standard theme-component location and carries the right SRI hash (`install.spec.js`). It has **not** been run in Discourse, which needs Docker, Postgres and Redis. Treat it as unverified.

## What cannot be verified by a machine

- The 15-minute install by a non-developer, on camera.
- Native-speaker review of the Dutch and German copy.
- That any of the services would stand behind the wording shown next to their name (`04` V1, V13).
