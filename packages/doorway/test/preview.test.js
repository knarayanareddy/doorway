import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoorway } from '../src/widget.js';

// A preview (the `preview` lab, a forced shape for demonstrations) must never be counted:
// no event, no report, no change to the device's Shift memory, whatever the outcome.

const NOW = Date.parse('2026-11-07T10:00:00Z');
const INSTALL = 'inst_abc123';

// Just enough DOM for card.js mount(): the card is built and torn down, nothing is clicked.
const fakeNode = () => {
  const n = { style: {}, dataset: {}, className: '', textContent: '', innerHTML: '', attached: false };
  n.setAttribute = () => {}; n.appendChild = () => {}; n.remove = () => {}; n.focus = () => {};
  n.addEventListener = () => {}; n.removeEventListener = () => {};
  n.querySelector = () => null; n.querySelectorAll = () => []; n.attachShadow = () => fakeNode();
  return n;
};
const fakeDoc = () => ({ activeElement: null, body: { appendChild() {} }, createElement: () => fakeNode(), addEventListener() {}, removeEventListener() {} });
const fakeStore = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

function setup({ preview = null } = {}) {
  const calls = { event: [], report: [], heartbeat: [], settled: 0 };
  const sender = {
    event: async (raw, opts) => { calls.event.push({ raw, opts }); return true; },
    report: async (raw) => { calls.report.push(raw); return true; },
    heartbeat: async (i, d) => { calls.heartbeat.push([i, d]); return true; },
  };
  const storage = fakeStore();
  const session = fakeStore();
  const listeners = {};
  const docListeners = {};
  const win = {
    navigator: { language: 'en' },
    addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    removeEventListener() {},
    document: { visibilityState: 'visible', addEventListener: (t, fn) => { (docListeners[t] ||= []).push(fn); } },
  };
  const leave = () => { for (const fn of listeners.pagehide || []) fn(); for (const fn of docListeners.visibilitychange || []) fn(); };
  const d = createDoorway({
    routes: { byLanguage: {} }, install: INSTALL, lang: 'en', labs: ['fork', 'wave', 'preview'], preview,
    storage, session, doc: fakeDoc(), win, sender, now: () => NOW, onSettled: () => { calls.settled++; },
  });
  return { d, calls, storage, leave };
}

test('a shipped exposure is counted once, and its outcome is written to Shift memory (control)', async () => {
  const { d, calls, storage } = setup();
  const exposure = d.trigger({ type: 'search' });
  exposure.finish('dismissed');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.event.length, 1);
  assert.equal(calls.event[0].raw.o, 'dismissed');
  assert.ok(storage.m.has('doorway:v1'), 'the real exposure wrote Shift memory');
});

for (const outcome of ['dismissed', 'continued', 'clicked_help', 'left_page', 'timeout']) {
  test(`a preview is never counted, whatever the outcome (${outcome})`, async () => {
    const { d, calls, storage } = setup({ preview: 'fork' });
    const exposure = d.trigger({ type: 'search' });
    exposure.finish(outcome);
    exposure.finish('left_page'); // a second leave after the first must also be silent
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(calls.event, [], 'no event is sent for a preview');
    assert.deepEqual(calls.report, [], 'no report is sent for a preview');
    assert.equal(storage.m.size, 0, 'no Shift memory is written, and no acted state either');
    assert.equal(calls.settled, 1, 'the frame still settles, so the layer is removed');
  });
}

test('a preview that the person walks away from (pagehide) never reaches the counter', async () => {
  const { d, calls, storage, leave } = setup({ preview: 'wave' });
  d.trigger({ type: 'search' });
  leave();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls.event, [], 'no left_page row for a preview');
  assert.equal(storage.m.size, 0);
});
