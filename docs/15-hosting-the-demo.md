# Hosting the demo as a public agent

The repository's `Dockerfile` runs the demo harness as a hosted service, so jurors can open a URL instead of cloning anything. **It contains mock data only.** Do not point real visitors at it.

## What is and is not verified

| Claim | Status |
|---|---|
| `scripts/serve-demo.mjs` serves the platform and the Door correctly on two different origins | **Verified locally**, by hand and by `npm run e2e:hosted` (6 browser tests against `localhost` and `127.0.0.1`, plus 20 unit tests of the configuration and the platform handler). |
| It exposes nothing it should not (no `/__test/*`, nothing outside `mock-platform/` and the loader, path traversal refused) | **Verified locally.** |
| The production dependency install is small and the lockfile is consistent | **Verified**: `npm ci --omit=dev` gives 10 MB (it was 243 MB before esbuild was moved to `dependencies`). |
| **The `Dockerfile` itself builds** | **Not verified.** There is no Docker on the machine that wrote it. Maritime builds from a repository on its own build worker; an agent box with Docker installed (see `docs/14`) could be used to test the build first. |
| A public Maritime agent wakes on an ordinary request, and the first visit after a sleep works | **Documented by Maritime, not yet seen working** here. |

## Why two deployments

The Door is a sandboxed iframe that is only isolated from the page because it lives on **another origin**. A single container has a single public origin, so the demo is two deployments of the same image:

| | Door | Platform |
|---|---|---|
| `ROLE` | `door` | `platform` |
| Serves | the real edge Worker on an in-memory SQLite, the Door page and bundle, the counter, the Desk, seeded with synthetic data | the mock forum (`labs.html`) and the built loader |
| Public URL | `https://<door-id>.mtm.sh` | `https://<platform-id>.mtm.sh` |

Both need to know both addresses (`DOOR_ORIGIN`, `PLATFORM_ORIGIN`, each an origin with no path), and the server refuses to start if they are missing or equal. The loader bakes the Door's origin in at build time, so the server builds it at start-up and one image serves any deployment (about a second).

## Environment

| Variable | Needed by | Meaning |
|---|---|---|
| `ROLE` | both | `door` or `platform` |
| `DOOR_ORIGIN`, `PLATFORM_ORIGIN` | both | the two public origins |
| `PORT` | both | injected by Maritime; the server binds `0.0.0.0:$PORT` |
| `LABS_FORMATS` | door | defaults to `fork,wave` because this is a demo; a production edge leaves it unset |
| `DESK_TOKEN` | door | the demo Desk's bearer token; defaults to `desk-demo-token`, which is public on purpose |
| `SEED` | door | `0` skips the synthetic data |

## Steps (not yet run)

Maritime gives an agent its URL at creation, and each deployment needs the other's, so the order is: create both, set the environment, restart.

```bash
# 1. create both from the repository (use -b feature/levelled-up until it is merged)
maritime create doorway-door     --repo https://github.com/knarayanareddy/doorway --public
maritime create doorway-platform --repo https://github.com/knarayanareddy/doorway --public
# 2. read each agent's id, then:   https://<door-id>.mtm.sh   https://<platform-id>.mtm.sh
maritime env set doorway-door     ROLE=door     DOOR_ORIGIN=https://<door-id>.mtm.sh PLATFORM_ORIGIN=https://<platform-id>.mtm.sh --no-secret --reload
maritime env set doorway-platform ROLE=platform DOOR_ORIGIN=https://<door-id>.mtm.sh PLATFORM_ORIGIN=https://<platform-id>.mtm.sh --no-secret --reload
# 3. open https://<platform-id>.mtm.sh/   (it redirects to the labs page)
```

Until step 2 the server exits with a clear message listing what is missing, so the first boot of each agent is expected to fail.

## Things to expect

- **The Door is slow on the first visit after a sleep.** The loader waits 5 seconds for the Door; a cold wake is documented as about a second plus the page load. If the Door is asleep when the platform page is not, the first trigger may show the "Door did not start" console message.
- **State lives in memory.** Maritime snapshots and resumes the process, so a sleep keeps it; a restart or redeploy reseeds the same synthetic data. Nothing is written to `/data`.
- **The write endpoint is reachable.** A browser can only write from the Door's own origin, but a non-browser can forge the `Origin` header. The per-minute (600) and daily (20,000) caps bound it, the data is mock, and the Desk labels every figure unauthenticated. That is acceptable for a demo and is exactly why the production Desk says so.
- **Cost.** Two agent boxes at $1 a month per 2 GB each, awake or asleep, drawn from the plan's included credit.
