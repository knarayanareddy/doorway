# VENDORED.md — third-party files, where they came from, and what we changed

Read this before modifying anything under `vendor/` or `mock-platform/`.
It is the contract between us and the organisers' code.

Upstream: `github.com/Hackathon-for-Good-The-Hague/HFG8-UNICRI-Stop-Before-It-Starts`
Licence: MIT, Copyright (c) 2026 Hackathon for Good - The Hague
Copied: 6 November 2026, from `main`

---

## Inventory

| Path | Upstream path | SHA-256 (of our copy) | Modified? |
|---|---|---|---|
| `vendor/contract/PLUGIN_CONTRACT.md` | `contract/PLUGIN_CONTRACT.md` | see `vendor/MANIFEST.sha256` | **no** |
| `vendor/contract/schemas/trigger-event.schema.json` | `contract/schemas/…` | ″ | **no** |
| `vendor/contract/schemas/module-config.schema.json` | ″ | ″ | **no** |
| `vendor/contract/schemas/module-result.schema.json` | ″ | ″ | **no** |
| `vendor/contract/schemas/metrics-event.schema.json` | ″ | ″ | **no** |
| `vendor/contract/schemas/help-services.schema.json` | ″ | ″ | **no** |
| `vendor/contract/schemas/legal-confidentiality.schema.json` | ″ | ″ | **no** |
| `vendor/contract/schemas/message-blocks.schema.json` | ″ | ″ | **no** |
| `mock-platform/index.html` | `mock-platform/index.html` | ″ | **2 lines** — see below |
| `mock-platform/platform.js` | `mock-platform/platform.js` | ″ | **no** |
| `mock-platform/search.html` | `mock-platform/search.html` | ″ | **yes** — 2 lines, the documented module swap (see vendor/README.md Provenance) |
| `mock-platform/style.css` | `mock-platform/style.css` | ″ | **no** |
| `mock-platform/fake-triggers.json` | `mock-platform/fake-triggers.json` | ″ | **no** |
| `mock-platform/demo-standin.css` | *(does not exist upstream)* | ″ | **new file, empty** |

Verify at any time:

```bash
shasum -a 256 -c vendor/MANIFEST.sha256
```

---

## The only two lines we changed

`mock-platform/index.html` differs from upstream in exactly two places, and both
are the swap `contract/PLUGIN_CONTRACT.md` tells an integrator to make:

```diff
-  <link rel="stylesheet" href="/starter-widget/widget.css">
+  <link rel="stylesheet" href="./demo-standin.css">

-  <script type="module" src="/starter-widget/widget.js"></script>
+  <script type="module" src="/packages/doorway/src/sbis-adapter-entry.js"></script>
```

Why the second one: upstream's mock platform loads the *starter* widget, which
is an example, not a product. Ours is the product. This line is the whole point
of the vendoring — it is what makes the demo "Doorway running in the mock
platform" rather than "the mock platform running itself".

Why the first one: we do not vendor `starter-widget/`, so that stylesheet would
404. Doorway renders inside a shadow root and brings its own CSS, so the file is
empty on purpose.

**Check this with:**

```bash
diff <(curl -s https://raw.githubusercontent.com/Hackathon-for-Good-The-Hague/HFG8-UNICRI-Stop-Before-It-Starts/main/mock-platform/index.html) mock-platform/index.html
```

Two hunks. If there are more, someone edited vendored code.

---

## What we deliberately did NOT vendor

| Upstream | Why not |
|---|---|
| `starter-widget/` | Ours is stronger (shadow DOM, focus trap, five formats). Vendor it and we would have two widgets and one ambiguity. |
| `starter-backend/` | Express. Our edge is Cloudflare Workers + D1; a second server is a second thing to run. |
| `tools/check-safety.js` | Needs Ajv. Reimplemented dependency-free as `scripts/check-safety.mjs` — same rules, from `safety.config.json`. |
| `tools/dashboard/` | Six aggregate counts. Ours carries eight fields with suppression. |
| `data/*.json` | We have the same facts in `packages/doorway/src/routes.nl.json`, with language-first alternatives. We fixed one bad URL from their copy (`stoppenismogelijk.nl` → `.eu`). |
| `research/`, `BRIEF.md` | Already absorbed into `research/` and `docs/`; ours is longer. |
| `CLAUDE.md` | Assistant context for a different tool. |

---

## Updating

```bash
BASE=https://raw.githubusercontent.com/Hackathon-for-Good-The-Hague/HFG8-UNICRI-Stop-Before-It-Starts/main
curl -s $BASE/mock-platform/platform.js -o mock-platform/platform.js
# …then re-apply the two-line swap to index.html, and regenerate the manifest:
find vendor mock-platform -type f | sort | xargs shasum -a 256 > vendor/MANIFEST.sha256
```

Never patch a vendored file to fix a bug. Fix it in `packages/`, adapt at
`packages/doorway/src/sbis-adapter.js`, and leave the vendored copy pristine —
otherwise "this is their code" stops being a checkable claim.
