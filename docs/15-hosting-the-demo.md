# Hosting the demo as a public agent

The repository's `Dockerfile` runs the demo harness as a hosted service, so jurors can open a URL instead of cloning anything. **It contains mock data only.** Do not point real visitors at it.

## What is and is not verified

| Claim | Status |
|---|---|
| `scripts/serve-demo.mjs` serves the platform and the Door correctly on two different origins | **Verified locally**, by hand and by `npm run e2e:hosted` (browser tests against `localhost` and `127.0.0.1`), plus the unit tests in `edge/test/serve-demo.test.js`. |
| It exposes nothing it should not (no `/__test/*`, nothing outside `mock-platform/` and the loader, path traversal refused) | **Verified locally.** |
| The production dependency install is small and the lockfile is consistent | **Verified**: `npm ci --omit=dev` gives 10 MB (it was 243 MB before esbuild was moved to `dependencies`). |
| **The `Dockerfile` itself builds** | **Not verified.** There is no Docker on the machine that wrote it, so the `app` stage (which builds the prototype) and the copy into the runtime image have never run. Maritime builds from a repository on its own build worker; an agent box with Docker installed (see `docs/14`) could be used to test the build first. |
| The prototype builds in the image and `/app/` answers on a sandbox | **Not verified.** The sandbox run below predates this; `/app/` answers 404 there until `npm run build:prototype` is run. |
| A public Maritime **agent** wakes on an ordinary request, and the first visit after a sleep works | **Documented by Maritime, not yet seen working** here. |
| The same server, hosted on public **sandbox** ports and used from a laptop over the internet | **Verified** on 7 November 2026 (see above and `docs/14`). |

## The route that was actually run: a Maritime sandbox

The same server ran on a Maritime **sandbox** on 7 November and was exercised over the internet (`docs/14`). That run had no built app, so `/app/` was 404; the prototype steps below are new and not yet run. It needs a key with `sandboxes` or `manage`. A sandbox ends by itself, disk included, so the demo exists only for the hours you ask for (at most 24).

This is the sequence that ran, assembled from separate steps rather than run as one script:

```python
from maritime import Maritime            # pip install maritime
client = Maritime(api_key=...)            # read from a file, never printed
box = client.ephemeral.create_ephemeral(from_="base", size="small", idle_minutes=20, time_limit_minutes=180)
sb = client.sandboxes.connect(box["id"])
urls = {p: sb.url(p, token=False) for p in (3000, 3001)}   # token=False makes the port PUBLIC to the internet
```

```bash
# inside the sandbox (Ubuntu 24.04; it has no xz, so use the .tar.gz)
sudo mkdir -p /opt/node && curl -sL https://nodejs.org/dist/v24.22.2/node-v24.22.2-linux-x64.tar.gz | sudo tar -xz -C /opt/node --strip-components=1
git clone --depth 1 -b wip/one-app https://github.com/knarayanareddy/doorway.git app && cd app
PATH=/opt/node/bin:$PATH npm ci --omit=dev
# the app that /app/ serves (prototype/dist/index.html); its devDependencies are needed only for this build
PATH=/opt/node/bin:$PATH npm --prefix prototype ci
PATH=/opt/node/bin:$PATH npm run build:prototype
# one process per role, each with its own DIST_DIR; the two origins are the two public port URLs; PROTO_DIST stays unset
ROLE=door     PORT=3001 DOOR_ORIGIN=<url 3001> PLATFORM_ORIGIN=<url 3000> DIST_DIR=$HOME/dist/d nohup /opt/node/bin/node scripts/serve-demo.mjs &
ROLE=platform PORT=3000 DOOR_ORIGIN=<url 3001> PLATFORM_ORIGIN=<url 3000> DIST_DIR=$HOME/dist/p nohup /opt/node/bin/node scripts/serve-demo.mjs &
```

Open `<url 3000>/app/`, the built app; `/` redirects there. The old labs page is still at `/mock-platform/labs.html`. Things that bit during the run:
- A port URL is **private by default** (it carries a secret `?token=`); only `token=False` opens it to everyone, so decide that on purpose.
- The Door of each demo needs its own port, because two roles cannot share an origin.
- Anything else on the sandbox, such as a Discourse that the loader is installed in, is just another port and another origin.

## Why two deployments

The Door is a sandboxed iframe that is only isolated from the page because it lives on **another origin**. A single container has a single public origin, so the demo is two deployments of the same image:

| | Door | Platform |
|---|---|---|
| `ROLE` | `door` | `platform` |
| Serves | the real edge Worker on an in-memory SQLite, the Door page and bundle, the counter, the Desk, seeded with synthetic data | the mock forum (`labs.html`) and the built loader |
| Public URL | `https://<door-id>.mtm.sh` | `https://<platform-id>.mtm.sh` |

Both need to know both addresses (`DOOR_ORIGIN`, `PLATFORM_ORIGIN`, each an origin with no path), and the server refuses to start if they are missing or equal. The loader bakes the Door's origin in at build time, so the server builds it at start-up and one image serves any deployment (about a second).

## The app and its Desk

The platform origin serves the built app (`prototype/dist/index.html`, from `npm run build:prototype`) at `/app/`, so the real Door frames inside it. Its Desk tab reads `/__desk/agg` on the same origin, which forwards the query and the Authorization header to the Door's `/v1/agg` and nothing else. That keeps the production edge free of CORS.

## Environment

| Variable | Needed by | Meaning |
|---|---|---|
| `ROLE` | both | `door` or `platform` |
| `DOOR_ORIGIN`, `PLATFORM_ORIGIN` | both | the two public origins |
| `PORT` | both | injected by Maritime; the server binds `0.0.0.0:$PORT` |
| `LABS_FORMATS` | door | defaults to `fork,wave` because this is a demo; a production edge leaves it unset |
| `DESK_TOKEN` | door | the demo Desk's bearer token; defaults to `desk-demo-token`, which is public on purpose |
| `I_UNDERSTAND_THIS_IS_A_PUBLIC_DEMO` | door, platform | set to `1` to start on a plain-http, non-localhost origin with the public `DESK_TOKEN`; without it the process refuses to start. https origins are not checked by this rule, so set a private `DESK_TOKEN` for any demo that should not be public |
| `SEED` | door | `0` skips the synthetic data |
| `PROTO_DIST` | platform | where the built app is. The image sets `/app/prototype/dist`; a sandbox leaves it unset (default `prototype/dist`). If `index.html` is missing the platform logs one `app not built` line and `/app/` answers 404 |

## Steps (not yet run)

Maritime builds the image from the `Dockerfile`, whose `app` stage runs the prototype build, so no separate step is needed. Maritime gives an agent its URL at creation, and each deployment needs the other's, so the order is: create both, set the environment, restart.

```bash
# 1. create both from the repository (use -b wip/one-app until it is merged: it holds the app at /app/)
maritime create doorway-door     --repo https://github.com/knarayanareddy/doorway --public
maritime create doorway-platform --repo https://github.com/knarayanareddy/doorway --public
# 2. read each agent's id, then:   https://<door-id>.mtm.sh   https://<platform-id>.mtm.sh
maritime env set doorway-door     ROLE=door     DOOR_ORIGIN=https://<door-id>.mtm.sh PLATFORM_ORIGIN=https://<platform-id>.mtm.sh --no-secret --reload
maritime env set doorway-platform ROLE=platform DOOR_ORIGIN=https://<door-id>.mtm.sh PLATFORM_ORIGIN=https://<platform-id>.mtm.sh --no-secret --reload
# 3. open https://<platform-id>.mtm.sh/app/   (the app; `/` redirects there)
```

After PR #6 is merged, use main.

Until step 2 the server exits with a clear message listing what is missing, so the first boot of each agent is expected to fail.

## Things to expect

- **The Door is slow on the first visit after a sleep.** The loader waits 5 seconds for the Door; a cold wake is documented as about a second plus the page load. If the Door is asleep when the platform page is not, the first trigger may show the "Door did not start" console message.
- **State lives in memory.** Maritime snapshots and resumes the process, so a sleep keeps it; a restart or redeploy reseeds the same synthetic data. Nothing is written to `/data`.
- **The write endpoint is reachable.** A browser can only write from the Door's own origin, but a non-browser can forge the `Origin` header. The per-minute (600) and daily (20,000) caps bound it, the data is mock, and the Desk labels every figure unauthenticated. That is acceptable for a demo and is exactly why the production Desk says so.
- **Cost.** Two agent boxes at $1 a month per 2 GB each, awake or asleep, drawn from the plan's included credit.
