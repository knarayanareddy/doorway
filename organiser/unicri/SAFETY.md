# Safety rules

These rules are non-negotiable. They apply to every file in this repository: code, data, tests, comments, commit messages and documentation.

## 1. No real abuse-related search terms

Not in code, data, tests, comments, commit messages or docs. The **only** trigger terms allowed are obviously fake placeholders that start with `test-trigger-` (for example `test-trigger-red`, `test-trigger-amber`). The automated safety check (`npm run check`) enforces this.

## 2. No real people, chats or user data

Everything in this repository is synthetic. Events and counts only — never message content, never identifiers that could point to a real person.

## 3. No tooling that identifies, exposes or tracks individuals

No fingerprinting, no IP logging, no cross-session user IDs. The `sessionScopedId` in the contract is random, regenerated per session and never persisted.

## 4. Measurement is aggregate only

Counters and rates, with small counts suppressed (below 10). See the [plug-in contract](contract/PLUGIN_CONTRACT.md) and the dashboard for how this works.

## 5. Do not invent facts

Phone numbers, URLs, legal articles and research findings must come from verified sources. If you cannot verify a fact during the hackathon, add a `[VERIFY]` marker in the text. Do not guess.

## 6. Write message texts in your own words

Do not copy warning texts from Lucy Faithfull Foundation, Protect Children or any platform. Each message block in `data/message-blocks.json` cites the evidence it is based on but uses original wording.

---

## Why these rules exist

This challenge deals with the prevention of child sexual abuse material (CSAM). The topic is legally sensitive, ethically serious and emotionally heavy.

- **Real search terms can teach evasion.** Publishing exactly what triggers a warning helps people avoid it. That is why trigger lists use only fake `test-trigger-*` entries.
- **Real data can harm real people.** Even anonymised data about this topic carries risk. Synthetic data avoids that entirely.
- **Tracking undermines trust.** People who might seek help will not do so if they think they are being watched. Aggregate-only measurement is a design choice, not a limitation.
- **Accuracy matters.** Wrong legal information could deter someone from seeking help. Every fact must be verified.

## Look after yourself

This topic is heavy. You can step away at any time during the hackathon. If you need support, speak to an organiser.

## The safety check

Run `npm run check` before every commit. It will fail if:

- Any file contains trigger terms not starting with `test-trigger-`
- A new file looks like a trigger/term/keyword list outside the allowed fake file
- A JSON data file does not validate against its schema

The check runs automatically in CI on every push and pull request.
