/**
 * Deterministic synthetic data for the Desk demo. Demo only: never run against
 * a production database. Every value is generated from a seeded PRNG, never
 * from real traffic, and every payload is validated by the same whitelist the
 * edge uses. The only difference is the labs formats (fork, wave), which the
 * production edge rejects.
 *
 * Writes agg, heartbeats and reports. Never writes installs (the install row is
 * the operator's job) and never writes rate.
 */
import { build, buildHeartbeat, buildReport, aggregateKey, REPORT_REASONS } from '../packages/core/src/counter.js';

const DAY_MS = 86400000;
const LAB_OPTS = { extraFormats: ['fork', 'wave'] };
const PACK = '2026.11.07';
const HEARTBEAT_VERSION = '0.2.0';

/** Weights are percentages. `click` is the per-exposure probability of clicked_help. */
const SHAPES = {
  gate:    { weight: 40, family: 'legal',   click: 0.010, buckets: [['1', 85], ['2', 15]] },
  card:    { weight: 18, family: 'harm',    click: 0.010, buckets: [['2', 70], ['1', 15], ['3', 15]] },
  hallway: { weight: 14, family: 'control', click: 0.022, buckets: [['3', 55], ['4', 45]] },
  door:    { weight: 6,  family: 'control', click: 0.028, buckets: [['5+', 80], ['4', 20]] },
  quiet:   { weight: 14, family: 'harm',    click: 0.008, buckets: [['1', 25], ['2', 25], ['3', 25], ['4', 15], ['5+', 10]] },
  fork:    { weight: 5,  family: 'harm',    click: 0.012, buckets: [['2', 100]], lab: true },
  wave:    { weight: 3,  family: 'control', click: 0.015, buckets: [['3', 100]], lab: true },
};
const TRIGGERS = [['search', 70], ['chat', 20], ['nav', 10]];
const ROUTES = [['nl-offlimits', 65], ['nl-stoppen', 20], ['fi-redirection', 10], ['xx-none', 5]];
/** Non-click outcomes, applied to the (1 - click) mass. */
const NON_CLICK = [['left_page', 50], ['dismissed', 21], ['continued', 22], ['timeout', 7]];

const WEEKDAY_BASE = 100;
const WEEKEND_BASE = 80;

/** Anomalies, by index into the day array (days-1 is today). */
const FORGED_IDX = (days) => days - 9;
const FORGED_EXPOSURES = 90;
const FORGED_CLICK_SHARE = 0.62;
const SPIKE_IDX = (days) => days - 4;
const SPIKE_MULTIPLE = 12; // must exceed flagAnomalies' 10x threshold

const HEARTBEAT_IDX = (days) => [days - 2, days - 12, days - 20];
const REPORT_COUNT = 8;

/** mulberry32: small, fast, deterministic. Returns floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, table) {
  const total = table.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, w] of table) {
    if (r < w) return value;
    r -= w;
  }
  return table[table.length - 1][0];
}

function checkedAgg(payload) {
  const res = build(payload, LAB_OPTS);
  if (!res.ok) throw new Error(`seedDemo: invalid agg payload: ${res.errors.join('; ')}`);
  return res.payload;
}

/**
 * Seed the demo tables. Returns the number of agg rows written, total exposures,
 * exposures per format, and the two anomaly days (ascending).
 * @param {import('node:sqlite').DatabaseSync} rawDb  the raw DatabaseSync (createDb().raw)
 */
export function seedDemo(rawDb, opts = {}) {
  const {
    install = 'inst_demo001',
    days = 30,
    today = new Date(),
    seed = 20261107,
    labs = true,
  } = opts;
  if (!Number.isInteger(days) || days < 10) {
    throw new Error('seedDemo: days must be an integer >= 10 (anomaly days sit at days-9 and days-4)');
  }

  const rng = mulberry32(seed);
  const shapeTable = Object.entries(SHAPES)
    .filter(([, s]) => labs || !s.lab)
    .map(([f, s]) => [f, s.weight]);
  const byFormat = Object.fromEntries(shapeTable.map(([f]) => [f, 0]));

  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  // Today is partial: only the hours elapsed so far (UTC) are counted.
  const elapsed = (today.getUTCHours() + 1) / 24;
  const dayStr = (i) => new Date(todayMs - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10);

  const perDay = [];
  const aggRows = [];
  const anomalyDays = [];
  let exposures = 0;

  for (let i = 0; i < days; i++) {
    const day = dayStr(i);
    const dow = new Date(todayMs - (days - 1 - i) * DAY_MS).getUTCDay();
    let total;
    let forced = 0;
    if (i === FORGED_IDX(days)) {
      total = FORGED_EXPOSURES;
      forced = Math.round(FORGED_CLICK_SHARE * total);
      anomalyDays.push(day);
    } else if (i === SPIKE_IDX(days)) {
      const prior = perDay.map((d) => d.total);
      const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
      total = Math.ceil(SPIKE_MULTIPLE * mean);
      anomalyDays.push(day);
    } else {
      const base = dow === 0 || dow === 6 ? WEEKEND_BASE : WEEKDAY_BASE;
      total = Math.round(base * (0.8 + 0.4 * rng()));
    }
    if (i === days - 1) total = Math.max(1, Math.round(total * elapsed));

    const cells = new Map();
    let clicked = 0;
    for (let n = 0; n < total; n++) {
      const f = pick(rng, shapeTable);
      const s = SHAPES[f];
      let outcome;
      if (forced > 0) {
        forced -= 1;
        outcome = 'clicked_help';
      } else if (rng() < s.click) {
        outcome = 'clicked_help';
      } else {
        outcome = pick(rng, NON_CLICK);
      }
      const payload = {
        i: install,
        v: `${s.family}-0${1 + Math.floor(rng() * 3)}`,
        f,
        t: pick(rng, TRIGGERS),
        e: pick(rng, s.buckets),
        o: outcome,
        r: pick(rng, ROUTES),
      };
      const key = aggregateKey(payload);
      const cell = cells.get(key);
      if (cell) cell.count += 1;
      else cells.set(key, { payload, count: 1 });
      byFormat[f] += 1;
      if (outcome === 'clicked_help') clicked += 1;
    }

    for (const [key, cell] of cells) {
      aggRows.push({ key, day, payload: checkedAgg(cell.payload), count: cell.count });
    }
    perDay.push({ day, total, clicked });
    exposures += total;
  }

  // Heartbeats: a few installs' Doors reporting dropped events on three days.
  const heartbeats = HEARTBEAT_IDX(days).map((i) => {
    const payload = { i: install, v: HEARTBEAT_VERSION, d: 1 + Math.floor(rng() * 6) };
    const res = buildHeartbeat(payload);
    if (!res.ok) throw new Error(`seedDemo: invalid heartbeat: ${res.errors.join('; ')}`);
    return { day: dayStr(i), version: HEARTBEAT_VERSION, dropped: payload.d };
  });

  // Reports: content-free, closed reason list, spread over days.
  const reports = [];
  for (let k = 0; k < REPORT_COUNT; k++) {
    const day = dayStr(Math.floor(rng() * days));
    const trigger = pick(rng, TRIGGERS);
    const reason = REPORT_REASONS[Math.floor(rng() * REPORT_REASONS.length)];
    const count = 1 + Math.floor(rng() * 9);
    const res = buildReport({ i: install, p: PACK, t: trigger, r: reason });
    if (!res.ok) throw new Error(`seedDemo: invalid report: ${res.errors.join('; ')}`);
    reports.push({ day, trigger, reason, count });
  }

  rawDb.exec('BEGIN');
  try {
    const upsertAgg = rawDb.prepare(
      `INSERT INTO agg (key, day, install, variant, format, trigger, bucket, outcome, route, count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key, day) DO UPDATE SET count = count + excluded.count`,
    );
    for (const r of aggRows) {
      const p = r.payload;
      upsertAgg.run(r.key, r.day, p.i, p.v, p.f, p.t, p.e, p.o, p.r, r.count);
    }
    const upsertHb = rawDb.prepare(
      `INSERT INTO heartbeats (install, day, version, dropped) VALUES (?, ?, ?, ?)
       ON CONFLICT(install, day, version) DO UPDATE SET dropped = dropped + excluded.dropped`,
    );
    for (const h of heartbeats) upsertHb.run(install, h.day, h.version, h.dropped);
    const upsertReport = rawDb.prepare(
      `INSERT INTO reports (install, day, pack, trigger, reason, count) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(install, day, pack, trigger, reason) DO UPDATE SET count = count + excluded.count`,
    );
    for (const r of reports) upsertReport.run(install, r.day, PACK, r.trigger, r.reason, r.count);
    rawDb.exec('COMMIT');
  } catch (err) {
    rawDb.exec('ROLLBACK');
    throw err;
  }

  return { rows: aggRows.length, exposures, byFormat, anomalyDays };
}
