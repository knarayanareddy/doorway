import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDoorway } from '../src/widget.js';
import { QUICK_EXIT } from '../src/labs.js';
import { QUICK_FAILED, QUICK_OPEN } from '../src/copy-labs.js';

// The quick exit is a labs button on the card. These tests press it through the real card click handler
// (packages/shared/card.js mount), with a fake window whose top.location.replace may throw, as a sandbox does.

const NOW = Date.parse('2026-11-07T10:00:00Z');

// Just enough DOM for mount(): nodes record their innerHTML and listeners, and the shadow root keeps its click handler.
function fakeDom() {
  const made = [];
  const node = (extra = {}) => {
    const n = { style: {}, dataset: {}, className: '', textContent: '', innerHTML: '', listeners: {}, ...extra };
    made.push(n);
    n.setAttribute = () => {}; n.appendChild = () => {}; n.remove = () => {}; n.focus = () => {};
    n.addEventListener = (t, fn) => { n.listeners[t] = fn; }; n.removeEventListener = () => {};
    n.querySelector = () => focusNode; n.querySelectorAll = () => []; n.attachShadow = () => shadow;
    return n;
  };
  const focusNode = node();
  const shadow = node();
  const doc = { activeElement: null, body: { appendChild() {} }, createElement: () => node(), addEventListener() {}, removeEventListener() {} };
  const card = () => made.find((n) => n.className === 'ovl').innerHTML;
  return { doc, shadow, card };
}

const fakeStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};

function setup({ refuse }) {
  const calls = { event: [], settled: 0 };
  const sender = {
    event: async (raw, opts) => { calls.event.push({ raw, opts }); return true; },
    report: async () => true,
    heartbeat: async () => true,
  };
  const opened = [];
  const navigations = [];
  const win = {
    navigator: { language: 'nl-NL' },
    top: { location: { replace: (u) => { if (refuse) throw new Error('navigation blocked by the sandbox'); navigations.push(u); } } },
    open: (...args) => { opened.push(args); return null; },
    addEventListener() {}, removeEventListener() {},
    document: { visibilityState: 'visible', addEventListener() {} },
  };
  const dom = fakeDom();
  const d = createDoorway({
    routes: { byLanguage: {} }, install: 'inst_abc123', lang: 'nl', labs: ['quick-exit'],
    storage: fakeStore(), session: fakeStore(), doc: dom.doc, win, sender, now: () => NOW,
    onSettled: () => { calls.settled++; },
  });
  // A real exposure (not a preview): the card is mounted and its shadow root holds the click handler.
  const exposure = d.trigger({ type: 'search' });
  const press = (target) => dom.shadow.listeners.click({ target: { closest: () => target } });
  const quit = { dataset: { sect: 'quit' }, closest: () => null };
  return { calls, opened, navigations, exposure, dom, press, quit };
}

test('quick exit refused by the browser: no left_page is sent, the card stays open with a visible fallback', () => {
  const s = setup({ refuse: true });
  s.press(s.quit);

  assert.equal(s.navigations.length, 0);
  assert.deepEqual(s.calls.event, [], 'nothing is reported while the person is still on the page');
  assert.equal(s.calls.settled, 0, 'the frame is not removed: the person can still act');
  assert.equal(s.exposure.finished, false);
  const html = s.dom.card();
  assert.ok(html.includes(QUICK_FAILED.nl), 'the fallback sentence is shown');
  assert.ok(html.includes(QUICK_OPEN.nl), 'the fallback offers the neutral site as a button');
});

test('quick exit refused: the fallback opens the same fixed neutral URL, and reports only what the person then does', () => {
  const s = setup({ refuse: true });
  s.press(s.quit);
  s.press({ dataset: { act: 'primary' }, closest: () => null });

  assert.deepEqual(s.opened, [[QUICK_EXIT.nl, '_blank', 'noreferrer,noopener']], 'the fixed constant, not a host value, in a new tab');
  assert.deepEqual(s.calls.event.map((e) => e.raw.o), ['continued'], 'one honest outcome: the person carried on, never left_page');
});

test('quick exit refused: the fallback can be dismissed, and that is reported as a dismissal', async () => {
  const s = setup({ refuse: true });
  s.press(s.quit);
  s.press({ dataset: { act: 'secondary' }, closest: () => null });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(s.calls.event.map((e) => e.raw.o), ['dismissed']);
  assert.equal(s.calls.settled, 1);
});

test('quick exit accepted by the browser: the card closes and reports left_page once (unchanged)', () => {
  const s = setup({ refuse: false });
  s.press(s.quit);

  assert.deepEqual(s.navigations, [QUICK_EXIT.nl]);
  assert.deepEqual(s.calls.event.map((e) => e.raw.o), ['left_page']);
  assert.equal(s.calls.event[0].opts.unloading, true);
  assert.equal(s.calls.settled, 1);
  assert.equal(s.opened.length, 0, 'no fallback tab on success');
  assert.ok(!s.dom.card().includes(QUICK_FAILED.nl), 'the fallback is never shown on success');
});
