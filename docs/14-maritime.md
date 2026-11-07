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
| Discourse | **Plausible on an agent box.** | On a desktop: no Docker or root. On an agent box: root, Docker runs containers, 4.9 GB persistent disk, 2.5 GB memory. Discourse itself is **not yet installed or tried**, and 2.5 GB is at the low end for it; reaching a container from outside is unverified (above). |
| A public demo for jurors | **Plausible.** | Documented: a public agent gets `https://<agent-id>.mtm.sh/`, sleeps when idle and wakes on any request. Needs a repo with a Dockerfile (this repo has none) and two agents, because the Door must be a different origin from the platform page. The wake behaviour is documented but **not yet seen working**. Mock data only. |
| Real Safari and iOS | **No.** | Linux, Windows and AOSP Android only: no macOS, no iOS, no Safari. Android would add a mobile Chromium or Firefox, not Safari. |
| Deploying the edge to Cloudflare | **No.** | The edge is a Cloudflare Worker with D1. Maritime runs containers and VMs; it is not a substitute and would change the architecture. |
| Counsel, service confirmation, a named reviewer, the five decisions | **No.** | These are about people, not infrastructure. |

## Honest fit with the product
Maritime suits *verification and demonstration* here, not production. The product's privacy argument rests on a small, auditable edge and no third-party processing of real visitors' traffic. Running real traffic through a general-purpose VM host would add a processor to the DPIA for no benefit. Use it only with mock data.

## What is still unknown
- Whether a container's published port is reachable from outside the box (port 8081 returned nothing, undebugged).
- Whether a public agent really wakes on an ordinary web request. Needs a web app with a Dockerfile.
- Whether Discourse installs and runs in 2.5 GB.
- Whether a sandbox differs from an agent box. The keys tried never had the `sandboxes` scope.

## Handling the key
A key pasted into a chat is exposed to that chat. Prefer `maritime onboard`, which signs in by a short code and never shows the key, or put it in a file outside the repository and revoke it afterwards. The key used for this test was kept in an owner-only file outside the repository, never in a command line, and deleted afterwards; revoke it anyway.
