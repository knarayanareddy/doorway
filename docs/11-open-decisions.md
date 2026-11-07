# Decisions the levelled-up design needs before it can ship

The prototype (`prototype/`) and the Door now share one core. Three parts of the design are live in the real Door: the shape sequence, the Glass Door and the Hallway (`12-shapes-and-glass-door.md`). The rest is parked behind decisions that are not engineering: they trade safety against safety, or need a person with the right expertise. Each is written so it can be decided in one sitting.

## D1 · Quick exit

**The goal.** Someone looking over a shoulder must be able to leave instantly, and the page they land on must not lead back.

**The conflict.** The real Door is a sandboxed cross-origin iframe. A frame cannot navigate the page that embeds it without a deliberate permission, and the host is treated as an adversary, so it cannot be relied on to honour a request.

| Option | What it costs |
|---|---|
| **A.** Add `allow-top-navigation-by-user-activation` to the sandbox | The Doorway origin could navigate the host page, but only on a real click. The Door is first-party, CSP-locked and loads only on a trigger. The host sees a page unload, which looks the same as closing the tab. |
| **B.** A third message `{exit: true}` that the loader acts on | The host learns "this visitor pressed quick exit", which is exactly the kind of per-person signal R9 refuses, and a hostile host can ignore it. |
| **C.** Open a neutral tab and keep the Door tab | Not an exit: the sensitive page stays one tab away. |

**Recommendation: A**, with `location.replace()` so the page leaves back-history, behind a security review of the permission, and disclosed to platforms. It is the only option that actually does the job. **Decider:** whoever owns the threat model.

## D2 · Holding the results

**The idea.** The gate holds the search results until the person acts.

**The conflict.** After `{settled}` the host must decide whether to show results. If it always does, "Back to the forum" is cosmetic and holding is theatre. If the Door tells it what the person chose, the host learns who continued, who asked for help, who said "I am here for work". That is the list of suspects R9 exists to prevent.

| Option | What it costs |
|---|---|
| **A.** Overlay only; the host always proceeds underneath | Honest and private. The results are behind the card, not withheld. This is what ships today. |
| **B.** Tell the host one bit (proceed / do not) | Leaks the person's choice to the adversary. |
| **C.** The platform withholds results server-side until the Door settles, then always shows them | Same as A for the person, plus a delay for everyone. No benefit. |

**Recommendation: A, and stop describing it as "holding".** The research case for holding results (Ahmia: no alternatives on screen) cannot be reproduced by a plug-in without leaking. Say so in the pitch. **Decider:** product owner.

## D3 · The Fork (asking the person where they stand)

**The idea.** Six honest answers (by accident, want to stop, cannot stop, worried about someone, under 18, here for work), each leading somewhere different.

**Open points.**
- It asks a visitor to self-identify inside a warning. The prototype never stores or sends the choice, but the act of being asked is the cost; ethics review needed, ideally with people with lived experience.
- "Here for work" is an honour-system bypass of anything that holds results. It is also the false-positive path (H4) and the counter has no way to record how often it is used, so that signal is lost.
- Six options is a lot for someone agitated; the plain-language rule argues for fewer.

**Until decided:** `fork` is a reserved name, rejected by the edge, absent from the shipped sequence.

## D4 · The Wave (urge-surfing exercise)

**The idea.** A short guided exercise and an if-then plan.

**Open points.** It borrows from relapse-prevention practice; there is no evidence here that it works for this population, and it is clinical-adjacent. It needs a clinician's review before any visitor sees it. The free-text plan was removed: presets only, kept for the tab session only.

**Until decided:** `wave` is reserved, as above.

## D5 · A verified youth route

The under-18 path now offers supportive neutral copy and **no link**, because the only candidate (Helpwanted) is named in the research but is not in the verified route data. Before this path can link anywhere, a named contact at a youth service must confirm it takes this contact and agree its wording (`04` V13 process).

## D6 · What the prototype may say about evidence

The line "about half first met this material by accident" is supported by the dossier (Nurmi et al. 2024) but comes from one survey of people who searched on the dark web. It is shown in the prototype as exactly that, with the citation. Do not generalise it.

## Already queued elsewhere

Service confirmation of privacy wording (`04` V1), Dutch counsel on the legal gate (V12), written OKs (V13), the production signing key (V14), real-Safari testing (V15), and a named false-positive reviewer (`10`).
