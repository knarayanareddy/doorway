import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapTrigger,
  outcomeFor,
  toCounterPayload,
  attach,
  TRIGGER_EVENT,
  RESULT_EVENT,
  __setEventCtor,
} from '../src/sbis-adapter.js';

test('low severity never interrupts', () => {
  assert.equal(mapTrigger({ severity: 'low' }).interrupt, false);
  assert.equal(mapTrigger({ severity: 'medium' }).interrupt, true);
  assert.equal(mapTrigger({ severity: 'high' }).interrupt, true);
});

test('an unknown severity is treated as medium, not as high', () => {
  // Fail toward the quieter behaviour: a widget that over-interrupts gets
  // uninstalled, and the contract's own default posture is restraint.
  assert.equal(mapTrigger({ severity: 'catastrophic' }).severity, 'medium');
  assert.equal(mapTrigger({}).severity, 'medium');
});

test('the navigation event type maps onto the counter vocabulary', () => {
  const t = mapTrigger({ type: 'navigation', language: 'nl-NL', country: 'nl' });
  const c = toCounterPayload(t, 'gate', 'legal', 'legal-01', 'clicked_help', 'nl-offlimits', '1');
  assert.ok(c.ok, JSON.stringify(c.errors));
  assert.equal(c.payload.t, 'nav');
  assert.equal(c.payload.r, 'nl-offlimits');
  assert.equal(c.payload.e, '1');
});

test('sessionScopedId and timestamps never reach the counter', () => {
  const t = mapTrigger({
    type: 'search',
    severity: 'high',
    country: 'NL',
    language: 'nl',
    sessionScopedId: 'abc-123-should-not-survive',
    timestamp: '2026-11-06T14:00:00Z',
  });
  const c = toCounterPayload(t, 'gate', 'legal', 'legal-01', 'clicked_help');
  const serialised = JSON.stringify(c.payload);
  assert.equal(serialised.includes('abc-123'), false, 'session id leaked into the payload');
  assert.equal(serialised.includes('2026-11-06'), false, 'timestamp leaked into the payload');
  assert.equal(Object.keys(c.payload).length, 8, 'exactly eight fields');
});

test('the counter rejects a variant outside the family pattern', () => {
  const t = mapTrigger({ severity: 'high', language: 'nl', country: 'NL' });
  const c = toCounterPayload(t, 'gate', 'legal', 'nonsense', 'clicked_help');
  assert.equal(c.ok, false);
});

test('only the contract\'s five outcomes are accepted', () => {
  assert.equal(outcomeFor('clicked_help'), 'clicked_help');
  assert.equal(outcomeFor('bounced'), 'dismissed');
  assert.equal(outcomeFor(undefined), 'dismissed');
});

test('attach wires the trigger event and tears down cleanly', () => {
  const listeners = new Map();
  const body = {
    addEventListener: (k, fn) => listeners.set(k, fn),
    removeEventListener: (k) => listeners.delete(k),
    dispatchEvent: () => {},
  };
  const doc = { body, defaultView: { localStorage: { getItem: () => null, setItem: () => {} } } };
  const stepped = [];
  const doorway = {
    step: () => { stepped.push(1); return { decision: { format: 'gate', family: 'legal' }, variant: 'legal-01' }; },
    onOutcome: () => {},
  };

  const teardown = attach({ doc, doorway, routes: { byLanguage: {} } });
  assert.ok(listeners.has(TRIGGER_EVENT));

  listeners.get(TRIGGER_EVENT)({ detail: { severity: 'high', type: 'search', language: 'nl', country: 'NL' } });
  assert.equal(stepped.length, 1, 'the widget was asked to step the Shift once');

  teardown();
  assert.equal(listeners.has(TRIGGER_EVENT), false);
});

test('a low-severity trigger reports a result but shows nothing', () => {
  const listeners = new Map();
  const fired = [];
  __setEventCtor(class { constructor(type, init) { fired.push({ type, detail: init?.detail }); } });
  const body = {
    addEventListener: (k, fn) => listeners.set(k, fn),
    removeEventListener: () => {},
    dispatchEvent: () => {},
  };
  const doc = { body, defaultView: { localStorage: { getItem: () => null, setItem: () => {} } } };
  let steppedTimes = 0;
  const doorway = { step: () => { steppedTimes++; return { decision: {}, variant: 'legal-01' }; }, onOutcome: () => {} };

  attach({ doc, doorway, routes: { byLanguage: {} } });
  listeners.get(TRIGGER_EVENT)({ detail: { severity: 'low', type: 'search' } });

  assert.equal(steppedTimes, 0, 'low severity must not mount an intervention');
  assert.equal(fired.length, 1);
  assert.equal(fired[0].type, RESULT_EVENT);
  assert.equal(fired[0].detail.shown, false);
  assert.equal(fired[0].detail.outcome, 'continued');
});
