# Would Maritime help?

Maritime (maritime.sh) is a managed cloud for AI agents: persistent "agent boxes" ($1 a month per 2 GB), one-task sandboxes, Linux, Windows and Android computers with a screen and a **takeover link a person can open**, and invite-only swarms. Read from its public agent guide, 7 November 2026, and then **tried once** with the account's own key: one Linux desktop, about 65 seconds, 0 cents against the plan's included credit (section below). Nothing in this repository depends on it.

## What was measured (7 Nov 2026, one Linux desktop, then deleted)

- **It starts fast.** A cold Linux desktop was `ready` in 19 seconds (the API reported an 18 s cold wake).
- **What is on it:** Debian 13, 2 vCPU, 4 GB of memory, **3.6 GB disk with 1.4 GB free**, an unprivileged user (`desk`), **no `sudo`**. Present: Node 20, Git, Python 3, curl, Chromium 156 (open on a visible desktop), `apt-get` (unusable without root) and Nix. Missing: **Docker, Podman, PHP, Postgres, Redis, Firefox**.
- **Network:** outbound HTTPS works (WordPress.org, npm, GitHub).
- **A person can take over.** `POST …/viewer {"mode":"control"}` returns a link (valid about 10 minutes) to a browser view of the desktop.
- **Taking over locks the agent out.** Once a control link exists, the API answers `human_in_control` to every action until the person finishes or the link expires. Plan a test as "set the machine up, then hand it over", not "drive it while they watch".
- **The key's reach:** this key could use computers, agents and swarms, but not sandboxes (`scope_missing`) or per-user usage. Windows and ARM Android are not available on this account.
- **Cost:** 64.8 seconds of computer time, billed as 0 cents; the Growth plan carries $100 of credit a month.

## What it would and would not fix

| Open item | Would Maritime help? | How |
|---|---|---|
| The 15-minute install by a non-developer, on camera | **Yes, with preparation.** | The takeover link and a visible Chromium work. WordPress needs PHP, which is absent and cannot be `apt`-installed without root; Nix is present and has network access, so PHP via Nix is plausible but **untested**. The disk is small. Hand over a pre-built machine, because the agent is locked out once the person takes control. About $0.12 an hour. Still needs the person. |
| Discourse | **Not on a desktop.** | Measured: no Docker, no Podman, no root, and 1.4 GB free disk. Discourse's supported install needs Docker with Postgres and Redis. A sandbox or agent box might differ, and this key cannot create sandboxes, so that is untested. |
| A public demo for jurors | **Partly.** | Host the demo harness in two agent boxes (the Door must be a different origin from the platform page). Unknown: whether a sleeping box wakes on an ordinary web request, and what URL each box gets. Mock data only. |
| Real Safari and iOS | **No.** | Linux, Windows and AOSP Android only: no macOS, no iOS, no Safari. Android would add a mobile Chromium or Firefox, not Safari. |
| Deploying the edge to Cloudflare | **No.** | The edge is a Cloudflare Worker with D1. Maritime runs containers and VMs; it is not a substitute and would change the architecture. |
| Counsel, service confirmation, a named reviewer, the five decisions | **No.** | These are about people, not infrastructure. |

## Honest fit with the product
Maritime suits *verification and demonstration* here, not production. The product's privacy argument rests on a small, auditable edge and no third-party processing of real visitors' traffic. Running real traffic through a general-purpose VM host would add a processor to the DPIA for no benefit. Use it only with mock data.

## What is still unknown
- Whether PHP installs via Nix on that desktop, and whether WordPress then fits in 1.4 GB.
- Whether an agent box gets a public URL, and wakes on an ordinary web request (needed for a hosted demo). Needs an agent box, about $1 a month per 2 GB, covered by the plan credit.
- Whether a sandbox can run Docker. Needs a key with the sandboxes scope.

## Handling the key
A key pasted into a chat is exposed to that chat. Prefer `maritime onboard`, which signs in by a short code and never shows the key, or put it in a file outside the repository and revoke it afterwards. The key used for this test was kept in an owner-only file outside the repository, never in a command line, and deleted afterwards; revoke it anyway.
