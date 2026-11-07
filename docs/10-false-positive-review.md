# False-positive reports: the mechanism, and the human who is still missing

`02` R7 admits the most obvious way Doorway does harm: a journalist, survivor, parent or researcher is warned. No deployment in the literature has a way to report that. This one has the mechanism; it does not yet have the person.

## The mechanism (built, tested)

- **Visitor, one click.** Every card carries a small low-key control, "This warning was a mistake" (nl/en/de). It counts the exposure as the person continuing and sends `POST /v1/report` `{install, pack, trigger kind, reason}`. The reason is always `other`: the Door never asks a visitor to say who they are (journalist, survivor…), because asking someone to self-identify inside a warning is itself intrusive.
- **Platform admin, categorised.** On the Desk, an admin can file a report with a reason from the closed list (`journalist`, `survivor`, `parent`, `researcher`, `accident`, `other`) when a user complains to them.
- **Content-free.** No query, no time finer than the day the server stamps, no session. Counts under *k* are hidden on the Desk.
- **Opaque to the host.** `host-adversary.spec.js` asserts the host learns nothing when a report is sent.

## What is missing: an owner

A report no one reads is a trust failure. Before a pilot, someone must be named, in writing, to:

1. read the weekly false-positive counts per install on the Desk;
2. contact the platform when an install's rate is high enough to suggest its trigger source is over-matching (Doorway cannot change a platform's list, and never sees it);
3. record the review in this file.

| Role | Name | Since | Cadence |
|---|---|---|---|
| Reviewer of false-positive counts | **unassigned** | — | monthly |
| Backup | **unassigned** | — | — |

This table is deliberately left unfilled. `npm run check:pilot` does not yet check it; add that check when a name exists.
