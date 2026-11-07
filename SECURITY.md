# Security

The full threat model is [`docs/02-threat-model.md`](docs/02-threat-model.md) (rules R1–R12, with what each one costs and the residual risk). This file says what the code does today, what it does not do, and how to report a problem.

## What leaves the visitor's browser

Seven fields, and nothing else (`packages/core/src/counter.js`): an install id `i`, a variant `v`, a format `f`, a trigger kind `t` (`search`, `chat` or `nav`), an outcome `o`, a route id `r`, and an exposure bucket `e` (`1`–`4` or `5+`). There is no session id, no timestamp, no query text and no exact count. The edge code does not read client-address headers into stored data. The hosting provider still sees connection addresses (docs/02, R10).

## Known limits, stated plainly

1. **Counts are self-reported.** The `Origin` check is a browser-enforced hint, not authentication. A script outside a browser can send any `Origin` it likes, and the install id is public in the platform's page source. So anyone can write counts to any install. The Desk labels every figure "self-reported by the install's page, unauthenticated" and flags implausible days (docs/02, R12). Treat the aggregates as evidence of activity, not as proof.
2. **Anyone who knows an install id can lock that install's writes.** Writes are limited per install per minute and per install per day (`rate_per_min`, `daily_cap`, `edge/c.js`). A third party who floods the install with its id can use up those limits, so the install's real writes get HTTP 429 until the minute or the day resets. A refused event is not retried: the Door counts it as a drop and reports the drops in a later heartbeat, which the same per-minute limit can also refuse (`packages/doorway/src/send.js`). The result is lost counts, not a lost card.
3. **Route claims.** The production bundle (`packages/doorway/src/routes.nl.json`) no longer contains any confidentiality wording. Until 7 November 2026 it did: six `conf` records (for example "nothing is reported to law enforcement", "statutory medical secrecy (OSL 25:1)") were signed into it. None had a verifying person, date or source, so the Door never rendered them (`isRenderableConfidence` in `packages/core/src/route.js`), but anyone who opened the signed file could read them. They now sit in `research/route-claims-unverified.json`, which is not signed and not shipped. A claim comes back into the bundle only when a named person at the service has confirmed it in writing.
4. **The pinned key in this repository is a development key.** Its private half exists only on a developer's machine, in `.keys/`, which is gitignored. A routes bundle signed with it is accepted by any Door built from this repository. `npm run check:prod-key` and `npm run build` both refuse that pin when `DOORWAY_PRODUCTION=1`. A build without that variable still accepts the dev key, so a production build is protected only when it is run with `DOORWAY_PRODUCTION=1`; `npm run verify` does not set it. Until a production key is pinned, do not describe the routes signature as protecting anything against the people who have the dev key.
5. **The demo routes file is signed with the same development key** (`packages/doorway/src/routes.demo.json`) and is used only when `DEMO_ROUTES=1`.
6. **The host page is untrusted** (docs/02, R9). A hostile host can draw its own fake card. The signed bundle protects the Door's links, not a page the host fakes.
7. **No external security review has been completed and published.** A review scored this project 6/10 before the changes listed here.

## Reporting a vulnerability

Please report privately: <https://github.com/knarayanareddy/doorway/security/advisories/new>. Do not open a public issue with exploit details. Do not include real search terms or any real person's data in a report; a description of the behaviour and a mock-platform reproduction is enough. There is no published response time.

## Keys and key rotation

- Routes are signed with Ed25519. The public key is pinned in `packages/doorway/src/pubkey.js`, and the Door refuses any bundle that does not verify against it. The private key never goes in the repository.
- **Generate a production key** outside the repository:
  `node scripts/gen-prod-key.mjs /absolute/path/outside/the/repo/doorway-routes.pem`
  The file is written with mode 0600 and never overwritten. The script refuses a relative path, a path inside the working tree, and an existing file. It prints only the public key and the steps.
- **Pin it:** replace the two exports in `packages/doorway/src/pubkey.js` with the printed lines.
- **Sign:** `DOORWAY_SIGNING_KEY_FILE=/absolute/path npm run sign`, then `npm run check:routes`. Re-sign the demo file with `node scripts/sign-routes.mjs --file=packages/doorway/src/routes.demo.json` under the same variable, or the demo test fails.
- **Prove it:** `DOORWAY_PRODUCTION=1 npm run check:prod-key` must print PASS.
- **Rotate:** generate a new key at a new path, repeat the steps above, and deploy. The Door trusts only the key pinned in its build, so a bundle signed with the old key is refused by the new build. Then delete the old private file. Revocation is by deletion and by the build no longer pinning the key; there is no revocation list.
- **Keys pasted during development** (for example a hosting-provider API key used for a trial) are exposed to the chat they were pasted into. The release owner must revoke every one of them. None is stored in this repository.
- **Secrets in the repository:** `npm run scan:secrets` checks the files git would commit and the full `git log --all -p` for key and token patterns. It prints the file, the commit, and the first four characters with the length, never the value. It does not cover gitignored files such as `.keys/`.
