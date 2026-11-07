#!/usr/bin/env node
/**
 * `npm run check:deploy` — refuses a deploy while edge/wrangler.toml still has the placeholder DOOR_ORIGIN.
 *
 * The placeholder (`https://door.doorway.example`) is valid TOML and `wrangler deploy` accepts it, but the Worker
 * then answers every write with 503. This check fails the deploy step early and tells the deployer what to edit.
 * Pure node, no network: it only reads edge/wrangler.toml.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reads DOOR_ORIGIN out of a wrangler.toml text. Returns { ok, message }.
 * A value is refused when it is missing, empty, not an absolute URL, or its host ends with `.example` (RFC 2606).
 */
export function checkDoorOrigin(tomlText) {
  const m = /^\s*DOOR_ORIGIN\s*=\s*"([^"]*)"/m.exec(tomlText);
  const value = m ? m[1].trim() : '';
  const fix = 'Edit DOOR_ORIGIN in edge/wrangler.toml to the Worker\'s real origin (for example https://door.yourdomain.org), then deploy again.';
  if (!value) return { ok: false, message: `DOOR_ORIGIN is missing or empty in edge/wrangler.toml. ${fix}` };
  let host;
  try { host = new URL(value).hostname; } catch { return { ok: false, message: `DOOR_ORIGIN "${value}" is not a URL. ${fix}` }; }
  if (host.endsWith('.example')) return { ok: false, message: `DOOR_ORIGIN "${value}" is the .example placeholder, so the Worker would refuse every write with 503. ${fix}` };
  return { ok: true, message: `DOOR_ORIGIN is ${value}` };
}

const CLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (CLI) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'edge', 'wrangler.toml');
  const { ok, message } = checkDoorOrigin(readFileSync(file, 'utf8'));
  if (!ok) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}
