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

### How the shapes look

Every shape uses one palette (night, paper, lamp; the preview's tokens). Shapes differ only in silhouette and layout, never in colour family.

- **Gate:** square corners, a full-width lamp rule across the top, the largest headline.
- **Card:** soft round corners, a pause motif (two lamp bars) above the headline, pill buttons.
- **Fork:** the choices become a two-column grid of tiles; the primary action sits below them.
- **Wave:** centred, a large breathing countdown ring with a lamp progress line under it.
- **Hallway:** a lamp light edge down the left side, phrases as chat bubbles with copy buttons.

## The Glass Door

Every shape except the quiet pill carries a "What does this send?" panel. It shows, at the moment the person is deciding whether to trust the Door:

- **the exact object** that leaves the browser, field by field, with the outcome still blank because it does not exist until they act. It is built from the same fields as the counter contract, so the panel and the contract cannot drift apart (`panels.test.js`, and an e2e test that compares the panel with the real network request);
- what is **never** sent;
- what **stays on the device**, with a button that wipes it and writes nothing back afterwards;
- an honest note that, like any website, the server can see a network address when the browser connects, and that the table the server writes has no column for it. It does not claim otherwise;
- how to check it yourself in the browser's developer tools.

The panel describes Doorway's own data handling, which the person can verify, not any service's confidentiality; the copy lint treats it separately for that reason.

## The door (exposure 5 and later)

The door is the shape for someone who keeps coming back: a wide dark panel with a door tile, a kicker ("Is it still open?"), a line that rotates with the exposure count (`titles[(n-5) % 3]`), one sentence, and one big action. Its rules come from `panels.js` (`doorPanel`), and what it may say about the line follows the same predicate as the Hallway:

- **open, with a call button** only when `isRenderableHours` passes, the hours say open, and the route has a dialable number. The button is a `tel:` link and counts as a help click. A "chat" link beside it goes to the service's own allow-listed site.
- **closed, with "opens at ..."** only under the same condition. The one action then goes to the self-help service, never to the closed line.
- **otherwise** neither open nor closed is claimed. The one action is a plain link to the service ("See help").

Carry on is a dismissal, the report control is unchanged, and the Glass Door is on the panel. Nothing new is sent: the seven-field payload and the allowed outcomes are the same as on every shape.

### Demo data

The shipped route bundle has no verified hours, so a shipped Door never shows open or closed. The demo harness needs a call button to show, so it uses a second, signed record:

- `packages/doorway/src/routes.demo.json` is the shipped bundle with two changes to the nl route, `verifiedAt` set and `demo: true`, plus a new version and signature. The test `door-panel.test.js` checks that nothing else differs.
- `scripts/build.mjs` reads `DEMO_ROUTES=1` and points the Door's routes import at that file. Only the three `demo` scripts in `package.json` set it. `npm run e2e` and the Playwright web server never do.
- A card shows **Demo data** (or *Demodata* / *Demodaten*) next to any hour or number that comes from the demo record, and never otherwise.

The demo record is signed with the dev key, the same key as the shipped bundle, so this is a demo mechanism and not a production one. Before any pilot, the production key replaces it and the demo record is deleted.

## Claims about services

The Hallway can show what a service says about its own privacy and whether its line is open, and nothing else about them. Both appear only through the same predicates that guard every claim (`isRenderableConfidence`, `isRenderableHours`): a named person at the service, a recent date, a source, an unexpired record. Today no route has one, so today the Hallway shows neither. That is the intended behaviour, not a gap.

## The prototype

`prototype/` is an interactive version for reviewers. It imports the real core instead of porting it, so it cannot drift from the Door. It also demos the two reserved shapes, tagged as such, and a clearly synthetic "reviewed-claims preview" so a viewer can see what a verified claim looks like.
