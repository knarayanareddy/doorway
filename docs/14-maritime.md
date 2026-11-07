# Would Maritime help?

Maritime (maritime.sh) is a managed cloud for AI agents: persistent "agent boxes" ($1 a month per 2 GB), one-task sandboxes, Linux, Windows and Android computers with a screen and a **takeover link a person can open**, and invite-only swarms. Read from its public agent guide, 7 November 2026, and then **tried once** with the account's own key: one Linux desktop, about 65 seconds, 0 cents against the plan's included credit (section below). Nothing in this repository depends on it.



- **It starts fast.** A cold Linux desktop was `ready` in 19 seconds (the API reported an 18 s cold wake).
- **What is on it:** Debian 13, 2 vCPU, 4 GB of memory, **3.6 GB disk with 1.4 GB free**, an unprivileged user (`desk`), **no `sudo`**. Present: Node 20, Git, Python 3, curl, Chromium 156 (open on a visible desktop), `apt-get` (unusable without root) and Nix. Missing: **Docker, Podman, PHP, Postgres, Redis, Firefox**.
- **Network:** outbound HTTPS works (WordPress.org, npm, GitHub).
- **A person can take over.** `POST …/viewer {"mode":"control"}` returns a link (valid about 10 minutes) to a browser view of the desktop.
- **Taking over locks the agent out.** Once a control link exists, the API answers `human_in_control` to every action until the person finishes or the link expires. Plan a test as "set the machine up, then hand it over", not "drive it while they watch".
- **The key's reach:** this key could use computers, agents and swarms, but not sandboxes (`scope_missing`) or per-user usage. Windows and ARM Android are not available on this account.
- **Cost:** 64.8 seconds of computer time, billed as 0 cents; the Growth plan carries $100 of credit a month.

## What was measured on an agent box (7 Nov 2026, template `zeroclaw`)

Much better than the desktop for building and hosting things.
- **Root.** `uid 0` on Debian 12, 1 vCPU, 2.5 GB memory, a 2 GB root disk (1.4 GB free) and a **persistent 4.9 GB `/data`**. Outbound HTTPS works. It took 75 seconds to become active from creation.
- **PHP installs in 12 seconds** with `apt-get` (PHP 8.2 plus SQLite, mbstring, XML and cURL), using 425 MB. A WordPress with the SQLite plugin fits.
- **Docker works.** `docker.io` installed in 21 seconds. The kernel has overlayfs, cgroups v2, namespaces, bridge, veth and netfilter. `dockerd` ran with `overlay2` and its storage on `/data`. A container pulled `alpine:3` from Docker Hub, ran, and had outbound network. This makes Discourse's supported install plausible, which the desktop could not do.
- **Not yet verified: reaching a container from outside.** Publishing port 8080 failed because Maritime's own forwarder owns that port (documented). Publishing 8081 then returned nothing (`HTTP 000`) and I did not debug it, so inbound port publishing from a container is unproven.
- **Not yet verified: wake on a web request.** The docs say a public agent gets `https://<agent-id>.mtm.sh/`, sleeps when idle, and any request wakes it in about a second (visibility must be set to public, which needs a verified email). I could not test it: this box serves nothing on a port (its URL returns 404 awake or asleep), and I did not make an agent framework public. It needs a real web app in a repo with a Dockerfile.
- **Cost:** about 128 seconds of agent-box time, billed as 0 cents. An agent box is $1 a month per 2 GB whether awake or asleep.
- **Cleanup limit of the key:** the key could create and run the box but **not delete it** (`manage` scope required).

## What was measured on a desktop (7 Nov 2026, one Linux desktop, then deleted)

| Open item | Would Maritime help? | How |
|---|---|---|
| The 15-minute install by a non-developer, on camera | **Yes, with preparation.** | The takeover link and a visible Chromium work on a **desktop**, but a desktop has no root, so no PHP. PHP does install on an **agent box** (root). So the setup would be a desktop with a browser pointed at a WordPress served from an agent box. Untested end to end. Hand over a ready setup, because the agent is locked out once the person takes control. Still needs the person. |
| Discourse | **Yes, shown working.** | A medium sandbox ran Discourse's own installer; Doorway loaded and opened inside it with Discourse's CSP on. Needs a key with `sandboxes` or `manage`. |
| A public demo for jurors | **Yes, shown working, for up to 24 hours at a time.** | The demo harness ran on public sandbox ports and was exercised from a laptop. It ends with the sandbox, so start it shortly before it is needed. Mock data only; the Desk token is public on purpose. |
| Real Safari and iOS | **No.** | Linux, Windows and AOSP Android only: no macOS, no iOS, no Safari. Android would add a mobile Chromium or Firefox, not Safari. |
| Deploying the edge to Cloudflare | **No.** | The edge is a Cloudflare Worker with D1. Maritime runs containers and VMs; it is not a substitute and would change the architecture. |
| Counsel, service confirmation, a named reviewer, the five decisions | **No.** | These are about people, not infrastructure. |

## Honest fit with the product
Maritime suits *verification and demonstration* here, not production. It has now done both for real: it hosted the demo and a working Discourse. The product's privacy argument rests on a small, auditable edge and no third-party processing of real visitors' traffic. Running real traffic through a general-purpose VM host would add a processor to the DPIA for no benefit. Use it only with mock data.

## What was measured on a sandbox (7 Nov 2026): the result that matters

A **sandbox** is the right machine for this project. It needs a key with the `sandboxes` scope (or `manage`, which includes it); a key with only `provision`, `deploy` and `secrets` cannot make one. See "Getting a key that works" below.

- **Speed and size.** A small sandbox (2 vCPU, 4 GB, 12 GB disk) started in 3 seconds; a medium (4 vCPU, 8 GB, **50 GB disk**) is $0.044 an hour. Ubuntu 24.04, `sudo` without a password, outbound HTTPS works.
- **Public URLs per port.** `sandbox.url(port)` returns `https://<port>-sbx-<id>.<host>.sb.mtm.sh`. **By default it carries a secret `?token=` and the port stays private**, so a visitor or a cross-origin frame cannot use it. `sandbox.url(port, token=False)` makes the port **public to the whole internet**. Different ports are different origins, which is exactly what the Door needs.
- **Cleanup is built in.** A sandbox ends, disk included, after its idle time (requests through a port URL count as activity) or at its time limit (at most 24 hours).
- **Docker works, with two fixes.** (1) Ubuntu's `iptables` uses nftables, which this kernel lacks: `update-alternatives --set iptables /usr/sbin/iptables-legacy`. (2) Docker 29 wants an iptables `raw` table the kernel lacks: set `{"allow-direct-routing": true}` in `/etc/docker/daemon.json`. Then containers run, have outbound network, and **a published container port is reachable** (the item that failed on the agent box).
- **The hosted demo runs here, with no Dockerfile.** Node 24 from nodejs.org's `.tar.gz` (the machine has no `xz`), `git clone`, `npm ci --omit=dev`, and four `scripts/serve-demo.mjs` processes on public ports: the platform and Door for the labs page, and a Door and a loader host for Discourse. Checked from a laptop over the internet with a real browser: the page and the Door are different origins; the Desk answers with its token and returns 401 without it; a write with a forged `Origin` is refused with 403; no browser console errors.
- **Discourse works, and Doorway works inside it.** Discourse's own `launcher bootstrap` succeeded on the medium sandbox in about 6 minutes (disk used: 7 GB of 50), served on public port 8080 with `DISCOURSE_FORCE_HTTPS` and no redirect loop. Doorway was installed the way a Discourse owner would: as a **theme component** with the tag in its `head_tag` field (added through a Rails runner here; the admin UI does the same). With Discourse's **Content-Security-Policy enabled** (`script-src 'nonce-…' 'strict-dynamic'`, no `frame-src`) the loader ran, the Door opened as a cross-origin frame, rendered the gate, and closed. The Desk's `gate` count went from 22 to 23 and the one POST was the seven-field payload to the Door's origin. Chromium only.
- **A real bug this found and we fixed:** with `integrity` and `crossorigin="anonymous"` the browser fetches the loader with CORS, so whoever serves it must send `Access-Control-Allow-Origin`. The first Discourse run was blocked by CORS because the test server did not. The server now sends it for the loader only, `INSTALL.md` states the requirement, and a unit test covers it.
- **Cost of everything above:** about a quarter of an hour of sandbox time, billed as 0 cents against the plan's credit.

## Getting a key that works

Keys are made under Settings, API keys. A key made **without opening Advanced** gets `provision`, `deploy`, `secrets` and `manage`, and `manage` covers deleting, sandboxes and computers. Opening Advanced and ticking `provision`, `deploy` and `secrets` produces a key with **no `manage`**, which can create agents but not delete them. The Advanced panel offers only those three boxes, so it cannot grant `sandboxes` or `computers`.

## What is still unknown or untested
- **Wake on a web request.** Public agents are documented to sleep and wake on any request, but that was never seen working. It does not apply to sandboxes, which end instead; a sandbox demo lives only until its time limit.
- **Firefox and WebKit inside Discourse.** The Discourse run used Chromium only.
- **Installing through Discourse's admin screens.** The component was created with a Rails runner; the screens that do the same were not clicked through.
- **Whether `docker.io` plus the two fixes survives a different sandbox image or a future kernel.** It worked on 7 November.
- **The `Dockerfile` itself has still never been built.** The sandbox path avoids needing it.

## Handling the key
A key pasted into a chat is exposed to that chat. Prefer `maritime onboard`, which signs in by a short code and never shows the key, or put it in a file outside the repository and revoke it afterwards. A key was pasted into the development conversation while this test ran, so it must be treated as exposed. Every key pasted during development must be revoked by the release owner. This document does not repeat any of them, and nothing here shows that they have been revoked. That revocation is an open action.
