#!/usr/bin/env node
/**
 * `npm run check:prod-key` — refuses a production build that pins the dev key.
 *
 *   node scripts/check-prod-key.mjs                   PASS note (dev key is fine for demos)
 *   DOORWAY_PRODUCTION=1 node scripts/check-prod-key.mjs   exit 1 while the dev key is pinned
 *
 * Part of `npm run verify`: while the dev key is pinned, that gate is meant to pass for demos.
 */
import { PUBLIC_KEY_RAW_B64U } from '../packages/doorway/src/pubkey.js';
import { evaluateProdKey } from './lib/prod-guard.mjs';

const { ok, note } = evaluateProdKey({ publicKey: PUBLIC_KEY_RAW_B64U, env: process.env });
if (!ok) {
  console.error(`✗ ${note}`);
  process.exit(1);
}
console.log(note);
