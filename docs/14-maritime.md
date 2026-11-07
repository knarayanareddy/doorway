# Would Maritime help?

Maritime (maritime.sh) is a managed cloud for AI agents: persistent "agent boxes" ($1 a month per 2 GB), one-task sandboxes, Linux, Windows and Android computers with a screen and a **takeover link a person can open**, and invite-only swarms. Read from its public agent guide, 7 November 2026. **Nothing in this repository uses it, and none of the below has been tried.** An account needs a card for the free trial, so it needs you.

## What it would and would not fix

| Open item | Would Maritime help? | How |
|---|---|---|
| The 15-minute install by a non-developer, on camera | **Yes, directly.** | A fresh Linux desktop with WordPress and the script tag, and a takeover link handed to a real tester. No setup on the tester's machine, and the machine is deleted afterwards. About $0.12 an hour. Still needs the person. |
| Discourse | **Maybe.** | Needs Docker, Postgres and Redis. Whether Docker runs inside a sandbox or desktop is not stated in what I read; test with one sandbox ($0.022 an hour) before relying on it. |
| A public demo for jurors | **Partly.** | Host the demo harness in two agent boxes (the Door must be a different origin from the platform page). Unknown: whether a sleeping box wakes on an ordinary web request, and what URL each box gets. Mock data only. |
| Real Safari and iOS | **No.** | Linux, Windows and AOSP Android only: no macOS, no iOS, no Safari. Android would add a mobile Chromium or Firefox, not Safari. |
| Deploying the edge to Cloudflare | **No.** | The edge is a Cloudflare Worker with D1. Maritime runs containers and VMs; it is not a substitute and would change the architecture. |
| Counsel, service confirmation, a named reviewer, the five decisions | **No.** | These are about people, not infrastructure. |

## Honest fit with the product
Maritime suits *verification and demonstration* here, not production. The product's privacy argument rests on a small, auditable edge and no third-party processing of real visitors' traffic. Running real traffic through a general-purpose VM host would add a processor to the DPIA for no benefit. Use it only with mock data.

## If you want to try it
1. You sign up and give me a key (`MARITIME_API_KEY`), and say yes to the cost (a few dollars for the above).
2. I would first check the three unknowns with one sandbox: can it run Docker, does a box wake on HTTP, what URL does it get.
3. Then, in order of value: the install-test desktop, then Discourse, then the hosted demo.

Do not paste the key into chat or a file in the repo.
