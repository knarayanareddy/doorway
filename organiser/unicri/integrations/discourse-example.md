# Discourse integration example

This document explains how to integrate the SBIS prevention widget into a
[Discourse](https://www.discourse.org/) forum as a theme component.

> **Safety note:** All example code uses `test-trigger-*` prefixed terms only.
> Never include real abuse-related search terms in source code.

For the full plug-in contract see
[`contract/PLUGIN_CONTRACT.md`](../contract/PLUGIN_CONTRACT.md).

---

## 1. Create a theme component

In your Discourse admin panel go to **Admin > Customize > Themes** and create a
new theme component. Add the following files.

### `</head>` tag (Settings > Common > Head)

Load the widget script on every page:

```html
<script
  src="https://your-cdn.example/sbis-widget.js"
  data-country="NL"
  data-language="nl"
  async
></script>
```

Replace the `src` URL with wherever you host the built widget bundle.

### `<body>` tag (Settings > Common > Body)

Add a mount point for the widget (the script will find this element):

```html
<div id="sbis-widget"></div>
```

---

## 2. Where Discourse fires search events

Discourse uses an internal `appEvents` service to broadcast UI events. The
relevant ones are:

| Event name | Fired when |
|---|---|
| `page:search-query` | A user submits a full-page search |
| `header:search-term-changed` | The header search field value changes |
| `composer:typed-reply` | The user types in the reply composer |

These events are available to any Discourse plugin or theme component via the
`api.appEvents()` helper inside an **initializer**.

---

## 3. Hook into `appEvents` to emit `sbis:trigger`

Create an initializer in your theme component
(`javascripts/discourse/initializers/sbis-trigger.js`):

```js
import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("0.1", (api) => {
  const appEvents = api.container.lookup("service:app-events");

  // Listen for full-page search submissions
  appEvents.on("page:search-query", (_query) => {
    // NOTE: we intentionally do NOT forward the query text to the widget.
    // The platform decides when to fire a trigger; the module never sees
    // the actual search terms.

    // In production this would check against your trigger list.
    // For testing, fire unconditionally or check a test-trigger-* flag.
    document.body.dispatchEvent(
      new CustomEvent("sbis:trigger", {
        detail: {
          type: "search",
          severity: "high",
          country: document.querySelector("#sbis-widget")?.dataset.country || "NL",
          language: navigator.language.split("-")[0] || "en",
          timestamp: new Date().toISOString(),
          sessionScopedId: crypto.randomUUID(),
        },
      })
    );
  });

  // Listen for header search typing (lower severity — just awareness)
  appEvents.on("header:search-term-changed", (_term) => {
    document.body.dispatchEvent(
      new CustomEvent("sbis:trigger", {
        detail: {
          type: "search",
          severity: "low",
          country: document.querySelector("#sbis-widget")?.dataset.country || "NL",
          language: navigator.language.split("-")[0] || "en",
          timestamp: new Date().toISOString(),
        },
      })
    );
  });
});
```

### Testing the initializer

Use Discourse's browser console to simulate a trigger without real terms:

```js
// Simulate a test trigger — uses only test-trigger-* prefixed terms
document.body.dispatchEvent(
  new CustomEvent("sbis:trigger", {
    detail: {
      type: "search",
      severity: "high",
      country: "NL",
      language: "en",
      timestamp: new Date().toISOString(),
      sessionScopedId: crypto.randomUUID(),
    },
  })
);
```

---

## 4. Collecting aggregate metrics

Optionally forward the widget's result events to your backend:

```js
document.body.addEventListener("sbis:result", (event) => {
  fetch("/sbis/api/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event.detail),
  });
});
```

This only sends aggregate outcome data (`shown`, `outcome`, `timestamp`).
No search terms or user identifiers are included.

---

## 5. Summary

| Step | What to do | Time estimate |
|------|-----------|---------------|
| 1 | Add theme component with `<script>` tag | 2 min |
| 2 | Add `#sbis-widget` div in body | 1 min |
| 3 | Create initializer that bridges `appEvents` to `sbis:trigger` | 10 min |
| 4 | (Optional) Forward `sbis:result` to metrics endpoint | 5 min |

For the full event schemas and privacy guarantees see the
[plug-in contract](../contract/PLUGIN_CONTRACT.md).
