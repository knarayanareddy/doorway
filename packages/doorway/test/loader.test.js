import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLoader, doorUrl, INSTALL_HINTS } from '../src/loader.js';
import { attach, mapTrigger, __setEventCtor } from '../src/sbis-adapter.js';

const DOOR = 'https://door.test';

function fakeEnv() {
  const listeners = [];
  const posted = [];
  const frames = [];
  const win = {
    addEventListener: (t, fn) => t === 'message' && listeners.push(fn),
    removeEventListener: (t, fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
  };
  const doc = {
    activeElement: { focus() { doc.refocused = true; } },
    body: { appendChild: (el) => { el.attached = true; frames.push(el); } },
    createElement: () => {
      const el = {
        attrs: {}, style: {}, listeners: {},
        setAttribute(k, v) { this.attrs[k] = v; },
        addEventListener(t, fn) { this.listeners[t] = fn; },
        remove() { this.attached = false; },
        focus() { this.focused = true; },
        contentWindow: { postMessage: (m, o) => posted.push({ m, o }) },
      };
      return el;
    },
  };
  const send = (frame, data, origin = DOOR) => listeners.slice().forEach((fn) => fn({ origin, source: frame.contentWindow, data }));
  return { win, doc, frames, posted, send, listeners };
}

test('the Door iframe is sandboxed, referrer-less, and hidden until ready', () => {
  const e = fakeEnv();
  const loader = createLoader({ ...e, doorOrigin: DOOR, install: 'inst_abc123', timeoutMs: 1e6 });
  loader.trigger('search');
  const f = e.frames[0];
  assert.equal(f.attrs.sandbox, 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  assert.equal(f.attrs.referrerpolicy, 'no-referrer');
  assert.match(f.style.cssText, /visibility:hidden/);
  assert.equal(f.src, 'https://door.test/v1/?i=inst_abc123');
  e.send(f, { settled: true });
});

test('host -> door carries only {trigger, type}, to the pinned origin, never a query', () => {
  const e = fakeEnv();
  const loader = createLoader({ ...e, doorOrigin: DOOR, install: 'inst_abc123', timeoutMs: 1e6 });
  loader.trigger('navigation', { query: 'SECRET QUERY' });
  e.frames[0].listeners.load();
  assert.deepEqual(e.posted, [{ m: { trigger: true, type: 'navigation' }, o: DOOR }]);
  assert.ok(!JSON.stringify(e.posted).includes('SECRET'));
  assert.equal(e.frames[0].src.includes('SECRET'), false);
  e.send(e.frames[0], { settled: true });
});

test('only {ready} and {settled} from the right origin and window are honoured', async () => {
  const e = fakeEnv();
  const loader = createLoader({ ...e, doorOrigin: DOOR, install: 'inst_abc123', timeoutMs: 1e6 });
  const p = loader.trigger('search');
  const f = e.frames[0];
  e.send(f, { settled: true }, 'https://evil.example');
  e.send(f, { settled: true, extra: 1 });
  e.send(f, { settled: 'yes' });
  e.send({ contentWindow: {} }, { settled: true });
  assert.equal(f.attached, true, 'forged settles are ignored');
  e.send(f, { ready: true });
  assert.equal(f.style.visibility, 'visible');
  e.send(f, { settled: true });
  await p;
  assert.equal(f.attached, false);
  assert.equal(e.doc.refocused, true, 'focus returns to where it was');
  assert.equal(e.listeners.length, 0, 'the message listener is removed');
});

test('a second trigger while the Door is open does not stack a second frame', () => {
  const e = fakeEnv();
  const loader = createLoader({ ...e, doorOrigin: DOOR, install: 'inst_abc123', timeoutMs: 1e6 });
  loader.trigger('search'); loader.trigger('chat');
  assert.equal(e.frames.length, 1);
  e.send(e.frames[0], { settled: true });
});

test('a Door that never starts is removed and the installer is told the fix', async () => {
  const e = fakeEnv();
  const logs = [];
  const fetchImpl = async () => ({ json: async () => ({ ok: false, reason: 'unverified' }) });
  const loader = createLoader({ ...e, doorOrigin: DOOR, install: 'inst_abc123', timeoutMs: 5, log: (m) => logs.push(m), fetchImpl });
  await loader.trigger('search');
  assert.equal(e.frames[0].attached, false, 'no invisible layer is left over the page');
  assert.ok(logs.includes(INSTALL_HINTS.blocked));
  assert.ok(logs.includes(INSTALL_HINTS.unverified), 'and the precise cause is reported');
});

test('a missing or malformed install id fails loudly and mounts nothing', async () => {
  for (const [install, hint] of [[undefined, 'missing-install'], ['nope', 'bad-install']]) {
    const e = fakeEnv(); const logs = [];
    await createLoader({ ...e, doorOrigin: DOOR, install, log: (m) => logs.push(m) }).trigger('search');
    assert.equal(e.frames.length, 0);
    assert.deepEqual(logs, [INSTALL_HINTS[hint]]);
  }
});

test('doorUrl only forwards two-letter country and jurisdiction codes', () => {
  assert.equal(doorUrl(DOOR, { install: 'inst_abc123', country: 'nl', legalJurisdiction: 'NL' }), 'https://door.test/v1/?i=inst_abc123&c=NL&j=NL');
  assert.equal(doorUrl(DOOR, { install: 'inst_abc123', country: '"><script>', legalJurisdiction: 'xxx' }), 'https://door.test/v1/?i=inst_abc123');
});

// ── the sbis seam ──────────────────────────────────────────────────────────
test('host-adversary: the sbis result tells the platform that the overlay settled, and nothing else', async () => {
  __setEventCtor(class { constructor(type, init) { this.type = type; this.detail = init.detail; } });
  const out = []; const handlers = {};
  const doc = { body: { addEventListener: (k, fn) => { handlers[k] = fn; }, removeEventListener: () => {}, dispatchEvent: (e) => out.push(e) } };
  const calls = [];
  attach({ doc, loader: { trigger: async (type, o) => { calls.push([type, o]); } } });
  handlers['sbis:trigger']({ detail: { type: 'navigation', severity: 'high', country: 'nl', sessionScopedId: 'LEAK', timestamp: 'x' } });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, [['nav', { country: 'NL' }]]);
  const d = out[0].detail;
  assert.deepEqual(Object.keys(d).sort(), ['durationMs', 'helpServiceId', 'outcome', 'shown', 'timestamp']);
  assert.equal(d.helpServiceId, null);
  assert.equal(d.outcome, 'continued');
  assert.ok(!JSON.stringify(out).includes('LEAK'));
});

test('low severity never opens the Door', async () => {
  const out = []; const handlers = {}; let opened = 0;
  const doc = { body: { addEventListener: (k, fn) => { handlers[k] = fn; }, removeEventListener: () => {}, dispatchEvent: (e) => out.push(e) } };
  attach({ doc, loader: { trigger: async () => { opened++; } } });
  handlers['sbis:trigger']({ detail: { severity: 'low' } });
  assert.equal(opened, 0);
  assert.equal(out[0].detail.shown, false);
  assert.equal(mapTrigger({ severity: 'catastrophic' }).severity, 'medium');
});
