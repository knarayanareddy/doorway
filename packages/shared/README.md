# packages/shared

**Card · Validate · Loop · A11y.**

Small primitives with zero dependencies, used by the Door, the Desk and the tests. They are
guarded by a fingerprint (`npm run check:shared`) so an accidental edit is caught: a change
here reaches every shape the Door renders.

```bash
node --test core.test.js
```

---

## The primitives

| Module | What it is | Used by |
|---|---|---|
| `card.js` | The decision surface. Shadow-DOM mounted, one primary action, phone-first, descriptor-validated so a headline that will not fit 320px is refused at build time rather than discovered in a demo. | The Door (every shape) |
| `validate.js` | Strict whitelist validation. **Unknown keys are rejected, not stripped** — a silently stripped identifier is an identifier someone believed they had removed. Plus k-anonymity suppression and a rate that cannot exist without its denominator. | The counter contract and the Desk |
| `loop.js` | The return path. Tells a person what their action caused. Doorway: service-side arrival counts. | Reserved: not wired into the Door yet |
| `a11y.js` | Focus trap, reduced-motion detection, plain-language linting, screen-reader announcement. | The Door |

---

## The rules this package encodes

1. **A card with no primary action is refused.** A gate with no way forward is a trap.
2. **Unknown keys are rejected.** Silent stripping is how identifiers survive a "removal".
3. **A rate is never reported alone.** `rate(n, d)` returns `d` alongside the value and flags small denominators.
4. **Loop messages never name a person who was helped.** And a non-causal arrival claim is labelled `association, not attribution`.
5. **Plain language is a build-time rule.** `MAX_SENTENCE_WORDS = 20`, enforced by lint, not by good intentions.
