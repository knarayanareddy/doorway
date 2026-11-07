#!/usr/bin/env node
/**
 * The routes bundle must be honest, signed, and unexpired before anything ships.
 *
 *   node scripts/check-routes.mjs           CI gate: honesty + signature + validity
 *   node scripts/check-routes.mjs --pilot   ALSO require, per route, a named contact and a
 *                                           written OK from the service (docs/03 capacity
 *                                           contract, review H5). Expected to fail until
 *                                           that outreach has happened.
 */
import fs from 'node:fs';
import { assertHonest, allRoutes, isRenderableConfidence } from '../packages/core/src/route.js';
import { verifyBundle } from '../packages/core/src/bundle.js';
import { PUBLIC_KEY_RAW_B64U } from '../packages/doorway/src/pubkey.js';

const bundle = JSON.parse(fs.readFileSync(new URL('../packages/doorway/src/routes.nl.json', import.meta.url), 'utf8'));
const problems = assertHonest(bundle);

const v = await verifyBundle(bundle, Uint8Array.from(Buffer.from(PUBLIC_KEY_RAW_B64U, 'base64url')));
if (!v.ok) problems.push(`bundle signature/validity: ${v.reason} — run node scripts/sign-routes.mjs after editing routes`);
else if (Date.parse(bundle.validUntil) - Date.now() < 14 * 86_400_000) problems.push(`bundle expires ${bundle.validUntil} — re-verify and re-sign within two weeks`);

if (process.argv.includes('--pilot')) {
  for (const { r, where } of allRoutes(bundle)) {
    const a = r.agreement;
    if (!a || !a.contact || !a.okRef || !a.okAt) problems.push(`${where} (${r.id}): no named contact and written OK from the service (agreement)`);
    if (r.channel !== 'selfhelp' && !isRenderableConfidence(r)) problems.push(`${where} (${r.id}): no verified confidentiality record — copy stays neutral (informational)`);
  }
}

if (problems.length) {
  console.error('\n✗ ROUTES CHECK FAILED\n');
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`✓ routes check passed — honest, signed (key ${PUBLIC_KEY_RAW_B64U.slice(0, 8)}…), valid until ${bundle.validUntil}`);
