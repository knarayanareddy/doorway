#!/usr/bin/env node
/**
 * Build the installable artifacts (review B5).
 *
 *   dist/door/door.js                    the Door bundle, served by the edge Worker (routes inlined)
 *   dist/door/desk.html, desk.js         the Desk (static)
 *   dist/v<version>/doorway.min.js       the host-side script-tag install (single file, no import attributes)
 *   dist/v<version>/manifest.json        version, SHA-384 SRI hash, door origin, and the ready-to-paste tag
 *
 *   DOOR_ORIGIN=https://door.example.org npm run build
 *
 * The Door origin is baked in at build time and cannot be overridden by a data
 * attribute: a host that could point the loader at another origin could point it at
 * a look-alike Door.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from 'esbuild';
import { VERSION } from '../packages/doorway/src/version.js';

const ROOT = new URL('..', import.meta.url).pathname;
const DOOR_ORIGIN = (process.env.DOOR_ORIGIN || 'https://door.doorway.example').replace(/\/$/, '');
if (!/^https?:\/\/[^/]+$/.test(DOOR_ORIGIN)) throw new Error(`DOOR_ORIGIN must be an origin, got ${DOOR_ORIGIN}`);
// DIST_DIR lets two builds run side by side (the hosted demo's two roles share one checkout in tests). It must be
// a directory of its own: the build empties it first.
const DIST = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(ROOT, 'dist');
if (DIST === ROOT || ROOT.startsWith(DIST + path.sep)) throw new Error(`DIST_DIR must be a directory of its own, got ${DIST}`);
const out = (...p) => path.join(DIST, ...p);
fs.rmSync(out(), { recursive: true, force: true });

const common = { bundle: true, minify: true, format: 'iife', target: 'es2022', legalComments: 'none', logLevel: 'warning', loader: { '.json': 'json' } };

await build({ ...common, entryPoints: [path.join(ROOT, 'packages/doorway/src/door.js')], outfile: out('door', 'door.js') });
await build({
  ...common,
  entryPoints: [path.join(ROOT, 'packages/doorway/src/loader-entry.js')],
  outfile: out(`v${VERSION}`, 'doorway.min.js'),
  define: { __DOOR_ORIGIN__: JSON.stringify(DOOR_ORIGIN) },
});

fs.copyFileSync(path.join(ROOT, 'desk/desk.html'), out('door', 'desk.html'));
fs.copyFileSync(path.join(ROOT, 'desk/desk.js'), out('door', 'desk.js'));

const file = out(`v${VERSION}`, 'doorway.min.js');
const bytes = fs.readFileSync(file);
const sri = 'sha384-' + crypto.createHash('sha384').update(bytes).digest('base64');
const tag = `<script src="${(process.env.CDN_BASE || 'https://cdn.doorway.example').replace(/\/$/, '')}/v${VERSION}/doorway.min.js" integrity="${sri}" crossorigin="anonymous" data-install="inst_xxxxxx" data-trigger-event="doorway:flag" defer></script>`;
fs.writeFileSync(out(`v${VERSION}`, 'manifest.json'), JSON.stringify({ version: VERSION, doorOrigin: DOOR_ORIGIN, file: 'doorway.min.js', bytes: bytes.length, integrity: sri, tag }, null, 2) + '\n');

fs.mkdirSync(out('latest'), { recursive: true });
fs.copyFileSync(file, out('latest', 'doorway.min.js')); // mock platform / local demo only; production uses the immutable versioned URL

// CMS packages, generated so the real URL and SRI hash are substituted — nothing to hand-edit.
const CDN_BASE = (process.env.CDN_BASE || 'https://cdn.doorway.example').replace(/\/$/, '');
const src = `${CDN_BASE}/v${VERSION}/doorway.min.js`;
const fill = (t) => t.replaceAll('{{VERSION}}', VERSION).replaceAll('{{SRC}}', src).replaceAll('{{SRI}}', sri);
fs.mkdirSync(out('wordpress', 'doorway'), { recursive: true });
fs.writeFileSync(out('wordpress', 'doorway', 'doorway.php'), fill(fs.readFileSync(path.join(ROOT, 'integrations/wordpress/doorway.php.tpl'), 'utf8')));
fs.mkdirSync(out('discourse', 'common'), { recursive: true });
fs.writeFileSync(out('discourse', 'common', 'head_tag.html'), fill(fs.readFileSync(path.join(ROOT, 'integrations/discourse/head_tag.html.tpl'), 'utf8')));
fs.copyFileSync(path.join(ROOT, 'integrations/discourse/about.json'), out('discourse', 'about.json'));

console.log(`built v${VERSION}  door=${DOOR_ORIGIN}`);
console.log(`  doorway.min.js  ${bytes.length} bytes  ${sri}`);
console.log(`  door.js         ${fs.statSync(out('door', 'door.js')).size} bytes`);
console.log(`\n${tag}\n`);
