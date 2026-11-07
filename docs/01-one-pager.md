# Doorway — one-pager

## The gap

The challenge brief's own example is a Dutch hobby forum with 20,000 members and one part-time moderator. It wants a warning and a route to help. Nothing on the market serves it.

**Seven free tools exist to find an illegal image on a small platform.** Cloudflare CSAM Scanning, Project Arachnid Shield, PhotoDNA, IWF Image Intercept, Tech Coalition Pathways, Google CSAI Match, NCMEC reporting. **Zero exist to interrupt the person looking.** The intervention layer is thin. The most-cited deployer, Project Intercept (Lucy Faithfull Foundation, a specialist charity), reports more than 70 million warnings across 22 interventions in two years. It builds bespoke messages with each partner, so it works at roughly one build a month (the dossier's figure) and does not reach small platforms.

## What we built

**Doorway** is built to install with one script tag and one event. It gates the search instead of decorating it, changes shape with each repeat, and routes the person to help without learning anything about them. How long a non-developer needs to install it is a target (under 15 minutes), not yet measured.

**The Door.** A gate, not a banner. Across four deployments the help-click rate runs from 0.0175% (Pornhub, reThink) to 12.44% (Ahmia), about 700 times. The dossier reads this as tracking how many alternatives were on screen, not what the message said. The four deployments differ in many ways, so this is a hypothesis to test. A plug-in cannot remove a platform's alternatives. It can withhold the result until the person acts, which is the strongest thing an installable module can do. **Nobody has tested gate against banner.**

**The Shift.** Everyone shows the same warning every time, and it becomes wallpaper. reThink's referral rate declined across its deployment. The sequence is gate, card, hallway, hallway, door, so the form changes as repetition continues. The first exposure states the legal consequence, once a reviewed record exists (it does not yet). The second states the harm. The hallway shows what happens if the person reaches out, and the door offers presence rather than pressure.

**The Routes.** Language-first, not country-first. In a survey of 4,493 (Insoll et al. 2024), 55% said they wanted to stop. Of the 266 who had tried to get help, 70.2% struggled to find an anonymous route, and in a Tor-population survey (Nurmi et al. 2024) 73.9% of those who sought help could not get it. Dutch UI goes to Offlimits. Anything else goes to ReDirection's six languages. Self-help is the default and humans are reserved for higher-need signals. The reason is capacity: Offlimits took about 2.6 contacts a day in 2022 (943 contacts over the year), and a successful module could overload it. Its current volume is not known (`docs/04` V8).

## What it refuses

| Refusal | Why |
|---|---|
| No session identifier | A random ID stops being anonymous the moment it appears twice. The kit's own `sessionScopedId` is better than a user ID and still wrong. |
| No query text | The module receives a trigger kind (`search`, `chat` or `nav`), never the text. |
| No redirect through our domain | It would hand us the IP of everyone who asked for help. |
| No public trigger lists | Safety rule 3. Packs are signed, private, verified installs only. |
| No classification model | The strongest predictor in the literature is frequency, and frequency is a counter. |
| No deterrence claim | Ahmia randomised over 3 million warnings across 140 days and found no detectable reduction in searching. |

**What leaves the browser: seven fields.** The install id, the copy variant, the shape, the trigger kind, the outcome, the help route and the escalation step (1 to 5 or more). No session, no timestamp, no local hour, and no exact exposure count, only a bucket. Demonstrable live in the network panel.

## The ask

A further build phase to pass the open acceptance tests in `DOORWAY-blueprint.html` §13. Its length has not been estimated, and the one-person install test has not been run. After that, a proposed pilot with a number of Dutch platforms still to agree, and a stepped-wedge study of gate against banner. Offlimits co-maintenance of the routes and hosting of the aggregate feed by the AI for Safer Children hub are under discussion. **No written agreement exists yet** (`docs/04` V13).

**Not proven, and nobody's is. So we ship the test with the product.**

---

*Hackathon for Good #8 · UNICRI · Stop Before It Starts · 6–8 November 2026*
