import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import http from 'node:http';
import { readConfig, platformHandler, appFile, appNotBuiltWarning } from '../../scripts/serve-demo.mjs';

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

// ── the public demo token must not face the open internet ───────────────────

test('readConfig: the public demo token on a plain-http origin that is not local is refused, and the message says why and how to fix it', () => {
  const { problems } = readConfig({ ...base, DOOR_ORIGIN: 'http://door.example.org' });
  assert.deepEqual(problems, ['DOOR_ORIGIN is not https and not localhost, and DESK_TOKEN is the public demo token. Set DESK_TOKEN to your own secret, or set I_UNDERSTAND_THIS_IS_A_PUBLIC_DEMO=1 if this really is a public demo.']);
});

test('readConfig: both plain-http origins are named together in one problem', () => {
  const { problems } = readConfig({ ...base, DOOR_ORIGIN: 'http://door.example.org', PLATFORM_ORIGIN: 'http://forum.example.org' });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^DOOR_ORIGIN and PLATFORM_ORIGIN are not https/);
});

test('readConfig: a loopback origin over plain http with the public token is fine (the local harness and the tests)', () => {
  for (const [door, platform] of [['http://127.0.0.1:8788', 'http://127.0.0.1:8789'], ['http://localhost:9112', 'http://localhost:9111']]) {
    assert.deepEqual(readConfig({ ...base, DOOR_ORIGIN: door, PLATFORM_ORIGIN: platform }).problems, [], door);
  }
});

test('readConfig: an https origin with the public token is not refused (a deliberately public hosted demo)', () => {
  assert.deepEqual(readConfig(base).problems, []);
});

test('readConfig: the public token given explicitly is still the public token', () => {
  const { problems } = readConfig({ ...base, DOOR_ORIGIN: 'http://door.example.org', DESK_TOKEN: 'desk-demo-token' });
  assert.equal(problems.length, 1);
});

test('readConfig: a real DESK_TOKEN lets a plain-http origin start', () => {
  assert.deepEqual(readConfig({ ...base, DOOR_ORIGIN: 'http://door.example.org', DESK_TOKEN: 'a-real-secret-of-some-length' }).problems, []);
});

test('readConfig: I_UNDERSTAND_THIS_IS_A_PUBLIC_DEMO=1 is the explicit way to run a public demo with the public token', () => {
  assert.deepEqual(readConfig({ ...base, DOOR_ORIGIN: 'http://door.example.org', I_UNDERSTAND_THIS_IS_A_PUBLIC_DEMO: '1' }).problems, []);
  assert.notDeepEqual(readConfig({ ...base, DOOR_ORIGIN: 'http://door.example.org', I_UNDERSTAND_THIS_IS_A_PUBLIC_DEMO: 'yes' }).problems, [], 'only the exact value 1 counts');
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
function call(method, url, reqHeaders = {}, h = handler) {
  return new Promise((resolve) => {
    const chunks = [];
    const res = new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb(); } });
    res.writeHead = (status, headers) => { res.status = status; res.headers = headers; };
    res.on('finish', () => resolve({ status: res.status, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    h({ url, method, headers: reqHeaders }, res);
  });
}

test('platformHandler: /health answers 200', async () => {
  const r = await call('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.body, 'ok');
});

test('platformHandler: / redirects to the app', async () => {
  const r = await call('GET', '/');
  assert.equal(r.status, 302);
  assert.equal(r.headers.location, '/app/');
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

test('platformHandler: only the loader is served with CORS, so integrity + crossorigin works from another site', async () => {
  const js = await call('GET', '/dist/latest/doorway.min.js');
  assert.equal(js.status, 200);
  assert.equal(js.headers['access-control-allow-origin'], '*');
  assert.equal(js.headers['cross-origin-resource-policy'], 'cross-origin');
  const page = await call('GET', '/mock-platform/index.html');
  assert.equal(page.headers['access-control-allow-origin'], undefined, 'forum pages are not opened to other origins');
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

// ── the built app and the Desk proxy on the platform origin ──────────────────

const protoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-demo-proto-'));
after(() => fs.rmSync(protoDir, { recursive: true, force: true }));
fs.writeFileSync(path.join(protoDir, 'index.html'), '<!doctype html><title>the app</title>');
fs.mkdirSync(path.join(protoDir, 'assets'));
fs.writeFileSync(path.join(protoDir, 'assets', 'x.js'), 'PROTO ASSET');
const appHandlerUnderTest = platformHandler(readConfig({ ...base, ROLE: 'platform', PROTO_DIST: protoDir }), root);

test('readConfig: PROTO_DIST is null unless given, and a given one is resolved', () => {
  assert.equal(readConfig(base).protoDist, null);
  assert.equal(readConfig({ ...base, PROTO_DIST: 'prototype/dist' }).protoDist, path.resolve('prototype/dist'));
});

test('platformHandler: /app/ and /app/index.html serve PROTO_DIST/index.html', async () => {
  for (const url of ['/app/', '/app/index.html']) {
    const r = await call('GET', url, {}, appHandlerUnderTest);
    assert.equal(r.status, 200, url);
    assert.match(r.headers['content-type'], /^text\/html/, url);
    assert.equal(r.body, '<!doctype html><title>the app</title>', url);
    assert.equal(r.headers['x-robots-tag'], 'noindex', url);
  }
});

test('platformHandler: /app/ answers 404 with a plain message when the app is not built', async () => {
  const r = await call('GET', '/app/');
  assert.equal(r.status, 404);
  assert.match(r.headers['content-type'], /^text\/plain/);
  assert.equal(r.body, 'app not built: run npm run build:prototype');
});

test('platformHandler: only index.html of the app directory is served, not its neighbours', async () => {
  const r = await call('GET', '/app/assets/x.js', {}, appHandlerUnderTest);
  assert.equal(r.status, 404);
  assert.doesNotMatch(r.body, /PROTO ASSET/);
});

test('appFile: PROTO_DIST/index.html when given, else prototype/dist/index.html under the root', () => {
  assert.equal(appFile(readConfig({ ...base, PROTO_DIST: 'somewhere' })), path.join(path.resolve('somewhere'), 'index.html'));
  assert.equal(appFile(readConfig(base), root), path.join(root, 'prototype', 'dist', 'index.html'));
});

test('appNotBuiltWarning: silent when the app file is there, one line naming the fix when it is not', () => {
  assert.equal(appNotBuiltWarning(path.join(protoDir, 'index.html')), null);
  const warning = appNotBuiltWarning(path.join(protoDir, 'missing', 'index.html'));
  assert.equal(warning, 'app not built: /app/ will answer 404; run npm run build:prototype');
  assert.equal(warning.split('\n').length, 1);
});

test('appNotBuiltWarning: a directory called index.html counts as not built', () => {
  fs.mkdirSync(path.join(protoDir, 'dir-not-file', 'index.html'), { recursive: true });
  assert.notEqual(appNotBuiltWarning(path.join(protoDir, 'dir-not-file', 'index.html')), null);
});

// A tiny stand-in for the Door's /v1/agg: it records what it was sent and answers 401 without the demo token.
const seen = [];
const door = http.createServer((req, res) => {
  seen.push({ url: req.url, headers: req.headers });
  if (req.headers.authorization !== 'Bearer desk-demo-token') { res.writeHead(401, { 'content-type': 'application/json', 'set-cookie': 'door=1' }); res.end('{"error":"unauthorized"}'); return; }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'set-cookie': 'door=1', 'x-door': 'yes' });
  res.end(JSON.stringify({ byFormat: {}, echo: req.url }));
});
await new Promise((resolve) => door.listen(0, '127.0.0.1', resolve));
after(() => { door.closeAllConnections(); door.close(); });
const deskH = platformHandler(readConfig({ ...base, ROLE: 'platform', DOOR_ORIGIN: `http://127.0.0.1:${door.address().port}` }), root);

test('platformHandler: /__desk/agg forwards the query and Authorization, and returns the Door status and body', async () => {
  const r = await call('GET', '/__desk/agg?i=inst_demo001&days=7', { authorization: 'Bearer desk-demo-token' }, deskH);
  assert.equal(r.status, 200);
  assert.equal(r.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(seen.at(-1).url, '/v1/agg?i=inst_demo001&days=7');
  assert.equal(seen.at(-1).headers.authorization, 'Bearer desk-demo-token');
  assert.deepEqual(JSON.parse(r.body), { byFormat: {}, echo: '/v1/agg?i=inst_demo001&days=7' });
});

test('platformHandler: /__desk/agg passes the Door refusal through: no token gives the Door 401', async () => {
  const r = await call('GET', '/__desk/agg?i=inst_demo001', {}, deskH);
  assert.equal(r.status, 401);
  assert.equal(r.body, '{"error":"unauthorized"}');
});

test('platformHandler: /__desk/agg forwards no cookies and returns no headers beyond the Door content-type and ours', async () => {
  const before = seen.length;
  const r = await call('GET', '/__desk/agg?i=inst_demo001', { authorization: 'Bearer desk-demo-token', cookie: 'session=secret' }, deskH);
  assert.equal(seen.length, before + 1);
  assert.equal(seen.at(-1).headers.cookie, undefined, 'the cookie must not reach the Door');
  assert.equal(r.headers['set-cookie'], undefined, 'the Door cookie must not reach the browser');
  assert.equal(r.headers['x-door'], undefined);
  assert.deepEqual(Object.keys(r.headers).sort(), ['cache-control', 'content-type', 'x-content-type-options', 'x-robots-tag']);
});

test('platformHandler: /__desk/agg is GET only', async () => {
  const before = seen.length;
  for (const method of ['POST', 'PUT', 'DELETE']) {
    assert.equal((await call(method, '/__desk/agg?i=inst_demo001', { authorization: 'Bearer desk-demo-token' }, deskH)).status, 405, method);
  }
  assert.equal(seen.length, before, 'a refused method never reaches the Door');
});

test('platformHandler: /__desk/agg answers 502 with JSON when the Door is down', async () => {
  const gone = http.createServer();
  await new Promise((resolve) => gone.listen(0, '127.0.0.1', resolve));
  const port = gone.address().port;
  await new Promise((resolve) => gone.close(resolve));
  const h = platformHandler(readConfig({ ...base, ROLE: 'platform', DOOR_ORIGIN: `http://127.0.0.1:${port}` }), root);
  const r = await call('GET', '/__desk/agg?i=inst_demo001', { authorization: 'Bearer desk-demo-token' }, h);
  assert.equal(r.status, 502);
  assert.equal(r.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(r.body), { error: 'door unreachable' });
});
