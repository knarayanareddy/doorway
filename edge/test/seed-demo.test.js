import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './d1-shim.js';
import { seedDemo } from '../../scripts/seed-demo.mjs';
import { build, aggregateKey, deskSummary, flagAnomalies } from '../../packages/core/src/counter.js';

const TODAY = new Date('2026-11-07T12:00:00Z');
const LABS_EXTRA = { extraFormats: ['fork', 'wave'] };

function seeded(opts = {}) {
  const db = createDb();
  const result = seedDemo(db.raw, { today: TODAY, ...opts });
  return { raw: db.raw, result };
}

const ORDER = {
  agg: 'key, day',
  heartbeats: 'install, day, version',
  reports: 'install, day, pack, trigger, reason',
};
const dump = (raw, table) => raw.prepare(`SELECT * FROM ${table} ORDER BY ${ORDER[table]}`).all();

test('seed-demo: same seed gives identical tables, a different seed differs', () => {
  const a = seeded();
  const b = seeded();
  for (const t of Object.keys(ORDER)) assert.deepEqual(dump(a.raw, t), dump(b.raw, t), t);
  assert.deepEqual(a.result, b.result);

  const c = seeded({ seed: 1 });
  assert.notDeepEqual(dump(a.raw, 'agg'), dump(c.raw, 'agg'));
});

test('seed-demo: every agg key matches aggregateKey and passes build() with labs formats; no zero counts', () => {
  const { raw } = seeded();
  const rows = raw.prepare('SELECT * FROM agg').all();
  assert.ok(rows.length > 0);
  for (const r of rows) {
    const payload = { i: r.install, v: r.variant, f: r.format, t: r.trigger, e: r.bucket, o: r.outcome, r: r.route };
    assert.equal(r.key, aggregateKey(payload));
    const res = build(payload, LABS_EXTRA);
    assert.equal(res.ok, true, JSON.stringify(res.errors));
    assert.ok(r.count >= 1, `zero count in ${r.key}`);
    assert.equal(r.install, 'inst_demo001');
  }
  // The production edge must still reject the labs shapes.
  const labRow = rows.find((r) => r.format === 'fork' || r.format === 'wave');
  assert.ok(labRow, 'labs rows expected by default');
  assert.equal(build({ i: labRow.install, v: labRow.variant, f: labRow.format, t: labRow.trigger, e: labRow.bucket, o: labRow.outcome, r: labRow.route }).ok, false);
});

test('seed-demo: labs:false writes no fork or wave rows', () => {
  const { raw, result } = seeded({ labs: false });
  const n = raw.prepare("SELECT COUNT(*) AS n FROM agg WHERE format IN ('fork','wave')").get().n;
  assert.equal(n, 0);
  assert.deepEqual(Object.keys(result.byFormat).sort(), ['card', 'door', 'gate', 'hallway', 'quiet']);
});

test('seed-demo: clicked_help share is 0.5%-3% excluding the anomaly day', () => {
  const { raw, result } = seeded();
  const [forgedDay] = result.anomalyDays;
  const s = raw.prepare(`SELECT SUM(count) AS total,
      SUM(CASE WHEN outcome = 'clicked_help' THEN count ELSE 0 END) AS clicked
      FROM agg WHERE day != ?`).get(forgedDay);
  const share = s.clicked / s.total;
  assert.ok(share >= 0.005 && share <= 0.03, `share ${share}`);
});

test('seed-demo: flagAnomalies flags exactly the two anomaly days with the expected reasons', () => {
  const { raw, result } = seeded();
  const perDay = raw.prepare(`SELECT day, SUM(count) AS total,
      SUM(CASE WHEN outcome = 'clicked_help' THEN count ELSE 0 END) AS clicked
      FROM agg GROUP BY day ORDER BY day`).all();
  const flagged = flagAnomalies(perDay);
  assert.deepEqual(flagged.map((f) => f.day), result.anomalyDays);
  assert.deepEqual(flagged[0].reasons, ['click-through above 40%']);
  assert.deepEqual(flagged[1].reasons, ['volume above 10x the previous mean']);
});

test('seed-demo: deskSummary is unauthenticated and click-through covers all exposures', () => {
  const { raw } = seeded();
  const rows = raw.prepare('SELECT outcome, count FROM agg').all();
  const total = rows.reduce((a, r) => a + r.count, 0);
  const clicked = rows.filter((r) => r.outcome === 'clicked_help').reduce((a, r) => a + r.count, 0);
  const summary = deskSummary(rows);
  assert.ok(summary.label.includes('unauthenticated'));
  assert.equal(summary.exposures, total);
  assert.equal(summary.clickThrough.clicked, clicked);
  assert.equal(summary.clickThrough.shown, total);
  assert.equal(summary.clickThrough.rate, clicked / total);
});

test('seed-demo: writes only agg, heartbeats and reports (installs and rate untouched)', () => {
  const { raw, result } = seeded();
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM installs').get().n, 0);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM rate').get().n, 0);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM agg').get().n, result.rows);
  assert.ok(raw.prepare('SELECT COUNT(*) AS n FROM heartbeats').get().n > 0);
  assert.ok(raw.prepare('SELECT COUNT(*) AS n FROM reports').get().n > 0);
});
