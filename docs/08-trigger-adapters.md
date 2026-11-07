# Trigger adapters — where a trigger comes from

**Doorway is the response layer only.** The README once promised to turn on "detection tools a small platform would never find". The repo has never contained any, and under the threat model it cannot honestly contain them:

- Matching **in the visitor's browser** means shipping the term list to every visitor (`02` R4: lists are never public — publishing what triggers a warning teaches people to avoid it).
- Matching **on a server Doorway runs** hands the list to the platform that `02` R9 treats as an adversary, or makes Doorway the holder of a store of abuse-related terms (`02` R2).

So Doorway does not detect. It is told *that* something fired and *what kind* it was.

## The interface

```js
window.doorway.trigger('search' | 'chat' | 'nav')
// or
document.dispatchEvent(new CustomEvent('doorway:flag', { detail: { type: 'search' } }))
// or the UNICRI contract's sbis:trigger on document.body
```

The argument is a **kind**, never a query, a user id or a score. `window.doorway.trigger()` returns a promise that resolves, with no value, when the overlay has settled.

## Three realistic sources

Each lives **outside** Doorway, in the platform's own stack, and Doorway never sees what it matched on.

1. **A hash-matching vendor webhook.** The platform already uses a hash-matching service for images or text; when it reports a hit, the platform's server renders the page with the event wired to fire. Doorway never sees the hash.
2. **A hotline's member list.** Recognised hotlines hold term lists under agreements with their members. Where a hotline already supplies such a list to a platform, the platform runs it in its own search handler and fires the event. Getting that list to platforms is a **legal and partnership problem owned by the hotline**, not a Doorway feature, and Doorway never hosts, relays or ships terms.
3. **The platform's own moderation queue.** A moderator or automated rule flags a post or a search pattern; the platform's code fires the event on the next matching visit.

A minimal wiring, with no list in it, looks like this:

```js
// platform's own code — `isFlaggedByMyTooling` is theirs, not ours
form.addEventListener('submit', (e) => {
  if (isFlaggedByMyTooling(input.value)) {
    e.preventDefault();
    window.doorway.trigger('search');   // the kind; never input.value
  }
});
```

## What is enforced

- No file in the repo or in any bundle looks like a term list; `npm run gate:privacy` fails the build if one appears. The only fixture is the organisers' `mock-platform/fake-triggers.json`, whose every entry is `test-trigger-*` (`npm run check`), and which is excluded from the scan for that reason.
- The counter's contract has no field that could carry a term, and `build()` rejects unknown keys instead of stripping them.

## What is not built

The three adapters above are descriptions, not packages. A reference adapter per source needs a partner that owns the source. That is weeks to months of outreach, not engineering.
