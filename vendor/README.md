# vendor/ — third-party files we did not write

Everything here is copied verbatim from
`github.com/Hackathon-for-Good-The-Hague/HFG8-UNICRI-Stop-Before-It-Starts`,
which is MIT licensed (Copyright (c) 2026 Hackathon for Good - The Hague).

**Do not edit anything in this directory.** If it needs to change, change it
upstream in our own `packages/` and adapt at the seam — that is what
`packages/doorway/src/sbis-adapter.js` is for. The whole point of vendoring is
that we can always tell our code from theirs.

| Path | What it is | Why it is here |
|---|---|---|
| `contract/PLUGIN_CONTRACT.md` | The plug-in interface, in prose | We wrote an adapter to this contract. A contract you have not copied into your repo is a contract you will violate silently. |
| `contract/schemas/*.json` | Seven JSON Schemas | The adapter's output is asserted against the ones that apply. |
| `mock-platform/` | The organisers' mock platform | The UNICRI deliverable is *"a working prototype, shown in the mock platform."* This is the harness that makes that demonstrable. |

## Running the mock platform with Doorway in it

The mock platform expects a module that listens for `sbis:trigger`. Ours does,
via the adapter. Serve the repo root over HTTP and point the mock at it:

```bash
# from the repo root
npx serve .          # or: python3 -m http.server 8080
# open /vendor/mock-platform/index.html
```

Then swap the script tag in `vendor/mock-platform/index.html`:

```html
<!-- replace: <script type="module" src="/starter-widget/widget.js"></script> -->
<script type="module" src="/packages/doorway/src/sbis-adapter-entry.js"></script>
```

Type any `test-trigger-*` term in the mock search box. `test-trigger-red` fires
`severity: high`; `test-trigger-green` fires `low`, which our adapter
deliberately answers with nothing at all.

## Provenance

Copied 6 November 2026. If the upstream files change, re-copy them and note the
date here rather than patching them locally — a locally patched vendored file is
the one thing that makes this directory worse than not having it.

Deliberate modifications (vendored files are otherwise pristine upstream):

- `mock-platform/search.html` — 2 lines, both the documented module swap:
  - line 8: `<link rel="stylesheet" href="/starter-widget/widget.css">` → `/mock-platform/style.css` (the starter stylesheet is not vendored and would 404)
  - line 64: `<script type="module" src="/starter-widget/widget.js"></script>` → `/packages/doorway/src/sbis-adapter-entry.js` (Doorway replaces the starter widget, matching the two-line swap already made in index.html)
