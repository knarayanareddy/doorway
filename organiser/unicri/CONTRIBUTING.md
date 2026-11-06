# Contributing

This guide explains how teams work on the repository during Hackathon for Good #8.

---

## How to Start

1. **Fork the repository** to your team's GitHub account (or create a branch if you have write access).
2. **Clone your fork** locally.
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Run the safety check** to make sure everything is green:
   ```bash
   npm run check
   ```
5. **Start the mock platform:**
   ```bash
   npm run dev
   ```
6. Open `http://localhost:3000/mock-platform/` and type `test-trigger-red` in the search bar.

---

## Branch Naming

Use this pattern:

```
team/<team-name>/<feature>
```

Examples:
- `team/blue-shield/interstitial-warning`
- `team/blue-shield/help-routing`
- `team/blue-shield/dashboard`

---

## Before Every Commit

Run the safety check:

```bash
npm run check
```

This will fail if:
- Any file contains trigger terms not starting with `test-trigger-`
- A new file looks like a trigger/term/keyword list outside the allowed fake file
- A JSON data file does not validate against its schema

The same check runs automatically in CI on every push and pull request.

Also run the tests:

```bash
npm test
```

---

## The Trigger-Term Rule

This is the most important rule in this repository.

**No real abuse-related search terms anywhere:** not in code, data, tests, comments, commit messages or documentation.

The **only** trigger terms allowed are obviously fake placeholders that start with `test-trigger-` (for example `test-trigger-red`, `test-trigger-amber`).

This rule exists because publishing what triggers a warning teaches people to avoid it. See [SAFETY.md](SAFETY.md) for the full explanation.

---

## Pull Requests

When you open a pull request, fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md). The checklist includes:

- `npm run check` passes (safety check)
- `npm test` passes
- No real abuse-related terms in code, data, comments or commit messages
- All trigger terms start with `test-trigger-`
- New data files have a JSON Schema and are validated
- Facts (phone numbers, URLs, legal references) are verified or marked with `[VERIFY]`

---

## Safety

Read [SAFETY.md](SAFETY.md) before writing any code. The key rules:

1. No real abuse-related search terms — only `test-trigger-*`
2. No real people, chats or user data — everything is synthetic
3. No tooling that identifies, exposes or tracks individuals
4. Measurement is aggregate only (counts suppressed below 10)
5. Do not invent facts — verify or mark with `[VERIFY]`
6. Write message texts in your own words — do not copy from existing platforms

---

## Adding Facts

If you add a phone number, URL, legal article or research finding:

1. **Verify it** against an authoritative source.
2. If you cannot verify it during the hackathon, add a `[VERIFY]` marker in the text.

---

## File Structure

```
research/          Evidence, personas, reading list
submission/        Templates for your team's deliverables
data/              Help services, legal info, message blocks (JSON)
contract/          Plug-in contract and JSON schemas
mock-platform/     The mock platform to test against
starter-widget/    Starter code for the warning widget
starter-backend/   Starter Express backend
tools/             Safety check, traffic generator, dashboard
test/              Tests
integrations/      Example platform integrations
```

---

## Questions

Ask your on-site mentor (Emma Persson, UNICRI) or email info@hackathonforgood.org.
