# Labs: the five parked decisions, built and tested

`docs/11-open-decisions.md` lists five things the levelled-up design wanted that nobody could responsibly ship: quick exit, holding results, the Fork, the Wave and a youth route. Each now exists as a **lab**: working code with tests, switched off by default, behind a decision that is still yours.

Built is not adopted. Nothing here is on in the shipped Door, and nothing here changes what a decision needs.

## See it

```bash
npm run demo:labs
# open http://127.0.0.1:8789/mock-platform/labs.html
# the Desk: http://127.0.0.1:8788/desk   install inst_demo001, token desk-demo-token
```

This starts the real edge Worker and the real Door bundle on two origins, seeds the Desk with 30 days of **synthetic** data (3,665 exposures, one forged day, one volume spike, dropped events, mistaken-warning reports), and serves a mock forum that plays the platform.

On the labs page: a control panel forces each shape, a panel shows exactly what the platform page was told (only that the Door settled), and a panel shows everything the page could observe about the visitor, a counter that stays at 0. Type `test-trigger-red` in the forum search to see results held behind a blur and always released.

## Turning a lab on

Only a platform can opt in, with an attribute on the script tag. Unknown values are ignored.

```html
<script src="…/doorway.min.js" data-install="inst_xxxxxx"
        data-labs="fork,wave,quick-exit" data-wave-seconds="90" defer></script>
```

| Lab | Does | Needs on the edge |
|---|---|---|
| `fork` | puts the Fork second in the sequence | `LABS_FORMATS` includes `fork` |
| `wave` | puts the Wave third | `LABS_FORMATS` includes `wave` |
| `quick-exit` | adds a "Quick exit" button; the frame gets one extra sandbox permission | nothing |
| `preview` | lets the page force a shape, for demos | nothing |

**A labs Door pointed at a production edge fails safely.** The production edge leaves `LABS_FORMATS` unset and rejects the `fork` and `wave` formats, so those events are dropped and counted in the Desk's "events the Door could not send". They never reach the aggregates.

A preview is never counted: it sends no event or report and changes no device memory.

## What each one does, what is tested, what is still open

### Quick exit (D1)
A button at the top of every card except the quiet pill. A click, or Enter on it, sends the whole page to a fixed neutral site (KNMI, Met Office or DWD by language) with `location.replace`, so Back does not return to the forum. The destination is chosen by the Door, never the host.

- The only change to the sandbox is `allow-top-navigation-by-user-activation`, and only when the lab is on. The shipped sandbox string is asserted unchanged.
- **Escape cannot exit.** Browsers do not count Escape as a user activation, so only a click or Enter can navigate the page. Escape still closes the Door.
- **Counting the exit is best effort.** One `left_page` is recorded where the engine delivers the beacon (Chromium does); Firefox and WebKit may cancel it as the page leaves. Leaving matters more than the count.
- A hostile host sees the page unload, which looks the same as closing the tab.
- **Still your call:** whether the Doorway origin may navigate a host page at all. That is a security review, not a test.

### Holding results (D2)
Implemented as the platform-side pattern in the mock forum: blur the results when a trigger fires, always release when the Door settles. The Door never tells the platform what the person chose, and a test shows the platform's log is identical whether the person pressed Escape, "something else" or the help button.

- A safety release after 8 seconds means a slow reader sees the results behind the overlay. That is deliberate: results must never stay hidden. It is also why this is cosmetic, not protection.
- **Recommendation unchanged:** stop describing it as holding.

### The Fork (D3)
Six answers, six paths. What is picked is **not sent and not stored** (tested: the request bodies are the usual seven fields, identical across answers, and neither `localStorage` nor `sessionStorage` is touched). "Here for work" continues and files the existing content-free report with reason `other`.

- Each path's button maps to a contract outcome (back is a dismissal, help is a help click). The aggregates therefore cannot tell most answers apart, but "continue" is shared by the work path and the generic "something else" button.
- **Still your call:** ethics review of asking a visitor to self-identify at all, ideally with people with lived experience. Copy is unreviewed in all three languages.

### The Wave (D4)
A timer with three phases, then a plan chosen from four presets. There is **no free-text input**. The plan is stored as a number (0 to 3), in `sessionStorage`, under one key, and disappears when the tab closes. The Glass Door says so, and its wipe button clears it.

- Building it found a real accessibility bug: pressing "Begin" hid the focused button and dropped keyboard focus, so Escape stopped working. Fixed in the shared card (focus moves to the status line).
- **Still your call:** a clinician's review. The card says "a skill, not a treatment", and nothing here is evidence that it works for this population.

### The youth route (D5)
`youthRoute()` returns a link **only** for a route marked `audience: "youth"` with a complete written agreement (contact, reference, date), an allow-listed destination, and an unexpired review. The shipped bundle has none, so the under-18 path offers supportive text and no link; a browser test asserts there is not one.

- Proven with synthetic records in unit tests (eight ways to fail, one way to pass). It cannot be demonstrated end to end with a real link, because the allow-list rightly refuses a made-up service.
- **Still your call:** a youth service that agrees to be named.

## Also fixed while building this
- Escape now works after clicking a choice in Safari, which does not focus clicked buttons. It is handled at the document level and closing is idempotent.
- The copy lint's `vertrau` pattern matched the ordinary German verb "vertrauen"; it now matches "vertraulich".
- Per-shape counts in the Desk use secondary suppression, so a hidden cell cannot be recovered by subtraction.
