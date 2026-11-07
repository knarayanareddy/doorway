# One shape per question, and the Glass Door

Most warnings are one message shown the same way every time. By the fifth identical warning the person no longer sees it. Doorway's answer is to change what each exposure is *for*, not only how loud it is.

## The sequence (shipped)

| Exposure | Shape | The question the person may be asking | What it does |
|---|---|---|---|
| 1 | **gate** | What is this? | The plain fact. Neutral unless a reviewed legal record exists for a jurisdiction the platform declared. |
| 2 | **card** | Why does it matter? | The harm, in a human voice. |
| 3 and 4 | **hallway** | What happens if I reach out? | Rehearses the contact: a first sentence to copy, a self-help alternative, and what the service says about itself *only if verified*. |
| 5+ | **door** | Is it still open? | Presence instead of pressure: one big action, a rotating non-judgemental line. |

Inside the re-warning window a retry escalates *in place* to the next shape as an inline card and never resets the clock (`shift.test.js`). Quiet is reserved for someone who has already acted. `fork` and `wave` are reserved names and are not shipped (`11`).

## The Glass Door

Every shape except the quiet pill carries a "What does this send?" panel. It shows, at the moment the person is deciding whether to trust the Door:

- **the exact object** that leaves the browser, field by field, with the outcome still blank because it does not exist until they act. It is built from the same fields as the counter contract, so the panel and the contract cannot drift apart (`panels.test.js`, and an e2e test that compares the panel with the real network request);
- what is **never** sent;
- what **stays on the device**, with a button that wipes it and writes nothing back afterwards;
- an honest note that, like any website, the server can see a network address when the browser connects, and that the table the server writes has no column for it. It does not claim otherwise;
- how to check it yourself in the browser's developer tools.

The panel describes Doorway's own data handling, which the person can verify, not any service's confidentiality; the copy lint treats it separately for that reason.

## Claims about services

The Hallway can show what a service says about its own privacy and whether its line is open, and nothing else about them. Both appear only through the same predicates that guard every claim (`isRenderableConfidence`, `isRenderableHours`): a named person at the service, a recent date, a source, an unexpired record. Today no route has one, so today the Hallway shows neither. That is the intended behaviour, not a gap.

## The prototype

`prototype/` is an interactive version for reviewers. It imports the real core instead of porting it, so it cannot drift from the Door. It also demos the two reserved shapes, tagged as such, and a clearly synthetic "reviewed-claims preview" so a viewer can see what a verified claim looks like.
