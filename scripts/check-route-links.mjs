#!/usr/bin/env node
/**
 * Fetch every help link in the signed routes bundle and fail if one does not load.
 * A dead link on the "See help" button defeats the product, and nothing else in the repo ever fetched them
 * (found when the English default pointed at a host that does not exist).
 *
 *   node scripts/check-route-links.mjs            network: needs internet, so it is not part of `npm run verify`
 */
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BUNDLE = fileURLToPath(new URL('../packages/doorway/src/routes.nl.json', import.meta.url));

/** Every distinct http(s) url a route offers, with the route ids that use it. Pure, unit-tested. */
export function collectUrls(bundle) {
  const found = new Map();
  const add = (route) => {
    if (!route || typeof route !== 'object') return;
    if (typeof route.url === 'string') found.set(route.url, [...(found.get(route.url) || []), route.id || '(no id)']);
  };
  for (const lang of Object.values(bundle.byLanguage || {})) {
    add(lang.default);
    for (const alt of lang.alternatives || []) add(alt);
  }
  for (const r of bundle.youth || []) add(r);
  return found;
}

async function load(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': 'doorway-link-check' } });
    return { ok: res.status >= 200 && res.status < 400, status: res.status, final: res.url };
  } catch (e) {
    return { ok: false, status: String(e.cause?.code || e.name || e.message).slice(0, 40), final: url };
  } finally {
    clearTimeout(timer);
  }
}

export async function main() {
  const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));
  const urls = collectUrls(bundle);
  let bad = 0;
  for (const [url, ids] of urls) {
    const r = await load(url);
    console.log(`${r.ok ? '✓' : '✗'} ${r.status}  ${url}  (${ids.join(', ')})`);
    if (!r.ok) bad++;
  }
  if (bad) { console.error(`\n${bad} help link(s) do not load. Fix the route, then re-sign: node scripts/sign-routes.mjs`); return 1; }
  console.log(`\n✓ all ${urls.size} help links load`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(await main());
