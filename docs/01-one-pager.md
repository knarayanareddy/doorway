# Doorway — one-pager

## The gap

A Dutch hobby forum with 20,000 members and one part-time moderator wants a warning and a route to help. Nothing on the market serves them.

**Seven free tools exist to find an illegal image on a small platform.** Cloudflare CSAM Scanning, Project Arachnid Shield, PhotoDNA, IWF Image Intercept, Tech Coalition Pathways, Google CSAI Match, NCMEC reporting. **Zero exist to interrupt the person looking.** The intervention layer is empty, and it is empty for a reason: the only organisation doing it well — Project Intercept, 70 million warnings, 22 bespoke interventions in two years — is a consultancy with a clinical team, and roughly one build per month is its structural ceiling.

## What we built

**Doorway** installs in an afternoon, gates the search instead of decorating it, changes shape every time it fires, and routes the person to help — without learning anything about them.

**The Door.** A gate, not a banner. The evidence that matters is a 700-fold spread in click-through across deployments — Ahmia 12.4%, Intercept ~1%, Google 0.73%, Pornhub 0.018% — and it tracks how many alternatives were on screen, not what the message said. A plug-in cannot remove a platform's alternatives. It can withhold the result until the person acts, which is the strongest thing an installable module can do, and **nobody has tested gate against banner.**

**The Shift.** Everyone shows the same warning every time; it becomes wallpaper. reThink's own referral rate declined across its deployment. On exposure one the message answers *"nobody was hurt."* By the fourth it is asking what the law costs. By the fifth the threat has failed four times, so the intervention changes **form** — gate to chat — and offers the only thing with a chance left: an exit.

**The Routes.** Language-first, not country-first. 55% of people using this material want to stop; 70% who look for help cannot find an anonymous route; 73.9% who find one still do not get help. Dutch UI goes to Offlimits; anything else to ReDirection's six languages. Self-help by default, humans for higher-need signals, because Offlimits takes 2.6 contacts a day and success would break it.

## What it refuses

| Refusal | Why |
|---|---|
| No session identifier | A random ID stops being anonymous the moment it appears twice. The kit's own `sessionScopedId` is better than a user ID and still wrong. |
| No query text | The module receives a boolean, never a string. |
| No redirect through our domain | It would hand us the IP of everyone who asked for help. |
| No public trigger lists | Safety rule 3. Packs are signed, private, verified installs only. |
| No classification model | The strongest predictor in the literature is frequency, and frequency is a counter. |
| No deterrence claim | Ahmia randomised 3.1 million warnings over 140 days and found no detectable reduction in searching. |

**What leaves the browser: eight fields.** No session, no timestamp, no exact exposure count — only the hour, and only a bucket. Demonstrable live in the network panel.

## The ask

A six-week build to reach all ten acceptance tests, then a pilot with fifteen Dutch platforms and a stepped-wedge study of gate-versus-banner. Offlimits co-maintains the routes; the AI for Safer Children hub hosts the aggregate feed.

**Not proven, and nobody's is. So we ship the test with the product.**

---

*Hackathon for Good #8 · UNICRI · Stop Before It Starts · 6 November 2026*
