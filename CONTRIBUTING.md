# Working on Doorway

## The rule that matters

**Never add a field to the counter.** Seven fields, and the omissions — no session id, no timestamp, no local hour, only an exposure bucket — are the entire privacy argument. If a feature needs more, it is the wrong feature. See `docs/02-threat-model.md`.

## Before you push

```bash
npm run verify
```

CI must be green. It runs 21 unit tests, the privacy gate and the copy lint.

## Where logic goes

- **Pure, testable logic → `packages/core/src/`.** No DOM, no network. This is where review effort should go.
- **Rendering → `packages/doorway/src/`.** Shadow DOM only, so a host page's CSS cannot break the warning.
- **Data → `data/messages/`.** Every message block needs a `source:` line naming the study or statute it rests on.

## Adding a message

1. Add it to `data/messages/` with a `source:` line.
2. Run `npm run lint:copy` — it will reject copy that assumes intent.
3. If it makes a confidentiality claim, it needs a source from `docs/04-open-verifications.md`.

## Never

- Type an abuse-related search term anywhere, including in a test fixture or an example.
- Test against a live platform.
- Log a request body in the edge worker.
