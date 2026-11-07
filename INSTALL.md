# Installing Doorway

Doorway is the **response layer**: when your platform decides a search or message needs a warning, Doorway shows it and routes the person to help. It does not detect anything and never receives what was typed. See `docs/08-trigger-adapters.md` for where a trigger comes from.

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

`npm run build` prints this tag with the real URL and SRI hash filled in (`dist/v<version>/manifest.json`). The URL is versioned and immutable: a new release is a new URL.

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

The Door origin is built into the file. It cannot be overridden by an attribute.

## 2. WordPress

`npm run build` generates `dist/wordpress/doorway/doorway.php` with the SRI hash filled in. Upload it as a plugin, activate it, then **Settings > Doorway** and paste your install id. Your moderation plugin fires `doorway:flag`. *Written and generated, not yet run inside a real WordPress.*

## 3. Discourse

Add `dist/discourse/common/head_tag.html` to a theme component and replace `inst_xxxxxx` with your install id. *Not yet run inside a real Discourse.*

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

## 8. Running your own edge

See `BUILD.md` → *Deploying the edge*.
