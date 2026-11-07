import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoorway } from '../src/widget.js';

// The `advance` lab (demo only): every trigger shows the next step, and each dismissal is recorded.
// The device's exposure memory still lives in the Door origin's storage, as in production.

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

function setup({ labs = [] } = {}) {
  const calls = { event: [] };
  const sender = {
    event: async (raw) => { calls.event.push(raw); return true; },
    report: async () => true,
    heartbeat: async () => true,
  };
  const storage = fakeStore();
  const win = { navigator: { language: 'en' }, addEventListener() {}, removeEventListener() {}, document: { visibilityState: 'visible', addEventListener() {} } };
  const d = createDoorway({
    routes: { byLanguage: {} }, install: INSTALL, lang: 'en', labs,
    storage, session: fakeStore(), doc: fakeDoc(), win, sender, now: () => NOW, onSettled() {},
  });
  return { d, calls, storage };
}

// Each exposure is finished with a dismissal, which is exactly what makes the real Shift go quiet.
async function burst(d, calls, n) {
  for (let i = 0; i < n; i++) d.trigger({ type: 'search' }).finish('dismissed');
  await new Promise((r) => setTimeout(r, 0));
  return calls.event;
}

test('advance: six triggers at the same moment walk gate to door, then stay on door', async () => {
  const { d, calls, storage } = setup({ labs: ['advance'] });
  const events = await burst(d, calls, 6);
  assert.deepEqual(events.map((e) => e.f), ['gate', 'card', 'hallway', 'hallway', 'door', 'door']);
  assert.deepEqual(events.map((e) => e.e), ['1', '2', '3', '4', '5+', '5+'], 'the bucket is the step actually shown');
  assert.ok(events.every((e) => e.o === 'dismissed'));
  assert.equal(JSON.parse(storage.m.get('doorway:v1')).n, 6, 'the device memory still counts exposures');
});

test('advance: the sent row has the same seven fields as production, and no new one', async () => {
  const { d, calls } = setup({ labs: ['advance'] });
  const [first] = await burst(d, calls, 1);
  assert.deepEqual(Object.keys(first).sort(), ['e', 'f', 'i', 'o', 'r', 't', 'v']);
});

test('without advance, the same dismissals give quiet on the immediate retry (default path pinned)', async () => {
  const { d, calls } = setup({ labs: [] });
  const events = await burst(d, calls, 2);
  assert.equal(events[0].f, 'gate');
  assert.equal(events[1].f, 'quiet', 'the shipped Shift answers a dismissed-then-repeated press with the quiet pill');
});

test('advance with an unrelated labs token still walks the sequence; an unknown token adds nothing', async () => {
  const { d, calls } = setup({ labs: ['advance', 'quick-exit'] });
  const events = await burst(d, calls, 2);
  assert.deepEqual(events.map((e) => e.f), ['gate', 'card']);
});
