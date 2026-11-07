# Fingerprint log

One entry per deliberate change to packages/shared/. Written by `node scripts/check-shared.mjs --write --reason "..."`.

## 2026-11-07
- Files: card.js
- Reason: Per-shape visual identity on one palette, the wide door panel, Wave ring and initial focus with preventScroll so cards open at the top

## 2026-11-07
- Files: card.js
- Reason: Closing actions run onSelect before finish, so a quick-exit navigation is not cancelled by the frame being removed

## 2026-11-07
- Files: card.js
- Reason: closing card action may return a view and stay open (quick exit refused by the browser shows a fallback instead of reporting left_page)
