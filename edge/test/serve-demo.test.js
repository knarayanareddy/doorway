import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { readConfig, platformHandler } from '../../scripts/serve-demo.mjs';

const DOOR = 'https://door.example.org';
const PLATFORM = 'https://forum.example.org';
const base = { ROLE: 'door', DOOR_ORIGIN: DOOR, PLATFORM_ORIGIN: PLATFORM };

// ── readConfig ───────────────────────────────────────────────────────────────

test('readConfig: a valid door and a valid platform config parse with no problems', () => {
  const door = readConfig(base);
  assert.deepEqual(door.problems, []);
  assert.equal(door.role, 'door');
  assert.equal(door.doorOrigin, DOOR);
  assert.equal(door.platformOrigin, PLATFORM);

  const platform = readConfig({ ...base, ROLE: 'platform' });
  assert.deepEqual(platform.problems, []);
  assert.equal(platform.role, 'platform');
});

test('readConfig: a missing or invalid ROLE is reported', () => {
  assert.match(readConfig({ DOOR_ORIGIN: DOOR, PLATFORM_ORIGIN: PLATFORM }).problems.join('\n'), /ROLE must be "door" or "platform"/);
  assert.match(readConfig({ ...base, ROLE: 'both' }).problems.join('\n'), /ROLE must be "door" or "platform"/);
});

test('readConfig: missing origins are each reported', () => {
  const problems = readConfig({ ROLE: 'door' }).problems;
  assert.ok(problems.includes('DOOR_ORIGIN is required'), problems.join('\n'));
  assert.ok(problems.includes('PLATFORM_ORIGIN is required'), problems.join('\n'));
});

test('readConfig: an origin with a path, query, fragment or credentials is refused', () => {
  for (const bad of [
    'https://door.example.org/path',
    'https://door.example.org/?x=1',
    'https://door.example.org/#frag',
    'https://user:secret@door.example.org',
    'https://:secret@door.example.org',
  ]) {
    const { problems } = readConfig({ ...base, DOOR_ORIGIN: bad });
    assert.match(problems.join('\n'), /DOOR_ORIGIN must be an origin like https:\/\/example.org, with no path/, bad);
  }
});

test('readConfig: DIST_DIR is null unless given, and a given one is resolved', () => {
  assert.equal(readConfig({ ...base, ROLE: 'door' }).distDir, null);
  assert.equal(readConfig({ ...base, ROLE: 'door', DIST_DIR: 'dist-hosted/door' }).distDir, path.resolve('dist-hosted/door'));
});

test('readConfig: a non-http(s) scheme is refused', () => {
  const { problems } = readConfig({ ...base, PLATFORM_ORIGIN: 'ftp://forum.example.org' });
  assert.match(problems.join('\n'), /PLATFORM_ORIGIN must be an origin/);
});

test('readConfig: the same DOOR_ORIGIN and PLATFORM_ORIGIN are reported as "must differ"', () => {
  const { problems } = readConfig({ ...base, PLATFORM_ORIGIN: DOOR + '/' });
  assert.match(problems.join('\n'), /DOOR_ORIGIN and PLATFORM_ORIGIN must differ/);
});

test('readConfig: a bad PORT is reported', () => {
  for (const bad of ['abc', '0', '65536', '80.5']) {
    assert.match(readConfig({ ...base, PORT: bad }).problems.join('\n'), /PORT must be a port number/, bad);
  }
});

test('readConfig: a trailing slash on an origin is stripped', () => {
  const cfg = readConfig({ ...base, DOOR_ORIGIN: DOOR + '/', PLATFORM_ORIGIN: PLATFORM + '/' });
  assert.deepEqual(cfg.problems, []);
  assert.equal(cfg.doorOrigin, DOOR);
  assert.equal(cfg.platformOrigin, PLATFORM);
});

test('readConfig: defaults are port 8080, labs fork,wave, the public demo token, and seeded data', () => {
  const cfg = readConfig(base);
  assert.equal(cfg.port, 8080);
  assert.equal(cfg.labsFormats, 'fork,wave');
  assert.equal(cfg.deskToken, 'desk-demo-token');
  assert.equal(cfg.seed, true);
});

test('readConfig: PORT, LABS_FORMATS and DESK_TOKEN are read when given; SEED=0 turns seeding off', () => {
  const cfg = readConfig({ ...base, PORT: '9112', LABS_FORMATS: 'fork', DESK_TOKEN: 'other-token', SEED: '0' });
  assert.deepEqual(cfg.problems, []);
  assert.equal(cfg.port, 9112);
  assert.equal(cfg.labsFormats, 'fork');
  assert.equal(cfg.deskToken, 'other-token');
  assert.equal(cfg.seed, false);
});

// ── platformHandler ──────────────────────────────────────────────────────────

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-demo-test-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
fs.mkdirSync(path.join(root, 'mock-platform', 'sub'), { recursive: true });
fs.mkdirSync(path.join(root, 'dist', 'latest'), { recursive: true });
fs.mkdirSync(path.join(root, 'edge'), { recursive: true });
fs.writeFileSync(path.join(root, 'mock-platform', 'index.html'), '<script src="http://127.0.0.1:8788/v1/"></script>');
fs.writeFileSync(path.join(root, 'dist', 'latest', 'doorway.min.js'), 'console.log(1);');
fs.writeFileSync(path.join(root, 'edge', 'c.js'), 'export default {};');
fs.writeFileSync(path.join(root, 'secret.txt'), 'TOP SECRET');

const handler = platformHandler(readConfig({ ...base, ROLE: 'platform' }), root);

/** Drive the handler with a fake request and a writable response; resolves once the response has ended. */
function call(method, url) {
  return new Promise((resolve) => {
    const chunks = [];
    const res = new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb(); } });
    res.writeHead = (status, headers) => { res.status = status; res.headers = headers; };
    res.on('finish', () => resolve({ status: res.status, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    handler({ url, method }, res);
  });
}

test('platformHandler: /health answers 200', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.body, 'ok');
});

test('platformHandler: / redirects to the labs page', async () => {
  const r = await call('GET', '/');
  assert.equal(r.status, 302);
  assert.equal(r.headers.location, '/mock-platform/labs.html');
});

test('platformHandler: an HTML page has the Door origin substituted for the harness default', async () => {
  const r = await call('GET', '/mock-platform/index.html');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /^text\/html/);
  assert.equal(r.body, `<script src="${DOOR}/v1/"></script>`);
});

test('platformHandler: the built loader is served from dist/latest', async () => {
  const r = await call('GET', '/dist/latest/doorway.min.js');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /^text\/javascript/);
  assert.equal(r.body, 'console.log(1);');
});

test('platformHandler: files outside the two allowed directories are not served', async () => {
  for (const url of ['/secret.txt', '/edge/c.js', '/package.json']) {
    assert.equal((await call('GET', url)).status, 404, url);
  }
});

test('platformHandler: path traversal is refused', async () => {
  for (const url of ['/mock-platform/../secret.txt', '/%2e%2e/secret.txt', '/mock-platform/%2e%2e/secret.txt', '/mock-platform/..%2fsecret.txt']) {
    const r = await call('GET', url);
    assert.equal(r.status, 404, url);
    assert.doesNotMatch(r.body, /TOP SECRET/, url);
  }
});

test('platformHandler: directories are not listed or served', async () => {
  for (const url of ['/mock-platform', '/mock-platform/', '/mock-platform/sub', '/dist/latest']) {
    assert.equal((await call('GET', url)).status, 404, url);
  }
});

test('platformHandler: non-GET methods are refused with 405', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    assert.equal((await call(method, '/mock-platform/index.html')).status, 405, method);
  }
});

test('platformHandler: every response carries noindex and no-store', async () => {
  const urls = [
    ['GET', '/health'], ['GET', '/'], ['GET', '/mock-platform/index.html'], ['GET', '/dist/latest/doorway.min.js'],
    ['GET', '/secret.txt'], ['GET', '/mock-platform/../secret.txt'], ['GET', '/mock-platform'], ['POST', '/health'],
  ];
  for (const [method, url] of urls) {
    const { headers } = await call(method, url);
    assert.equal(headers['x-robots-tag'], 'noindex', `${method} ${url}`);
    assert.equal(headers['cache-control'], 'no-store', `${method} ${url}`);
  }
});
