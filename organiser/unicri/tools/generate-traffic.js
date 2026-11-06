// ALL DATA IS SYNTHETIC — see SAFETY.md
// generate-traffic.js — CLI tool to produce synthetic funnel events
// Usage: node tools/generate-traffic.js [--sessions N] [--variants name1,name2]

import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Argument parsing ────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function flag(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}

const SESSION_COUNT = Number(flag('sessions', '500'));
const VARIANT_NAMES = flag('variants', 'control,deterrent-v1').split(',');

// ── Outcome rates per variant ───────────────────────────────────────────────
// Rates: [clicked_help, dismissed, continued, left_page]  (must sum to ~1)
const DEFAULT_RATES = {
  control:        { clicked_help: 0.01, dismissed: 0.25, continued: 0.50, left_page: 0.24 },
  'deterrent-v1': { clicked_help: 0.15, dismissed: 0.30, continued: 0.35, left_page: 0.20 },
  'deterrent-v2': { clicked_help: 0.18, dismissed: 0.28, continued: 0.32, left_page: 0.22 },
};

function ratesFor(variant) {
  if (DEFAULT_RATES[variant]) return DEFAULT_RATES[variant];
  // For unknown variants, interpolate toward the strong-deterrent profile
  return { clicked_help: 0.10, dismissed: 0.28, continued: 0.40, left_page: 0.22 };
}

// ── Random helpers ──────────────────────────────────────────────────────────
function pickOutcome(rates) {
  const r = Math.random();
  let cumulative = 0;
  for (const [outcome, prob] of Object.entries(rates)) {
    cumulative += prob;
    if (r <= cumulative) return outcome;
  }
  return 'continued'; // fallback
}

function randomTimestamp(daysBack = 7) {
  const now = Date.now();
  const offset = Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(now - offset).toISOString();
}

// ── Generate events ─────────────────────────────────────────────────────────
const events = [];

for (let i = 0; i < SESSION_COUNT; i++) {
  const sessionId = randomUUID();
  const variant = VARIANT_NAMES[i % VARIANT_NAMES.length];
  const ts = randomTimestamp();
  const rates = ratesFor(variant);

  // 1. Trigger event — the moment the intervention fires
  events.push({
    session_id: sessionId,
    variant,
    event: 'trigger',
    timestamp: ts,
    synthetic: true,
  });

  // 2. Shown event — the nudge is displayed
  events.push({
    session_id: sessionId,
    variant,
    event: 'shown',
    timestamp: ts,
    synthetic: true,
  });

  // 3. Outcome event
  const outcome = pickOutcome(rates);
  events.push({
    session_id: sessionId,
    variant,
    event: outcome,
    timestamp: ts,
    synthetic: true,
  });
}

// Sort by timestamp for realism
events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

// ── Write output ────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, 'dashboard', 'generated');
mkdirSync(outDir, { recursive: true });

// JSONL
const jsonlPath = resolve(outDir, 'traffic.jsonl');
const jsonlContent = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
writeFileSync(jsonlPath, jsonlContent, 'utf-8');

// CSV
const csvPath = resolve(outDir, 'traffic.csv');
const csvHeader = 'session_id,variant,event,timestamp,synthetic';
const csvRows = events.map(
  (e) => `${e.session_id},${e.variant},${e.event},${e.timestamp},${e.synthetic}`,
);
writeFileSync(csvPath, [csvHeader, ...csvRows].join('\n') + '\n', 'utf-8');

// ── Console summary ─────────────────────────────────────────────────────────
const summary = {};
for (const e of events) {
  if (e.event === 'trigger' || e.event === 'shown') continue;
  summary[e.variant] ??= {};
  summary[e.variant][e.event] = (summary[e.variant][e.event] || 0) + 1;
}

console.log('\n=== Synthetic Traffic Generator ===');
console.log(`ALL DATA IS SYNTHETIC — see SAFETY.md\n`);
console.log(`Sessions : ${SESSION_COUNT}`);
console.log(`Variants : ${VARIANT_NAMES.join(', ')}`);
console.log(`Events   : ${events.length}`);
console.log(`Output   : ${jsonlPath}`);
console.log(`           ${csvPath}\n`);

for (const [variant, counts] of Object.entries(summary)) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`[${variant}] (n=${total})`);
  for (const [outcome, count] of Object.entries(counts)) {
    const pct = ((count / total) * 100).toFixed(1);
    console.log(`  ${outcome.padEnd(16)} ${String(count).padStart(5)}  (${pct}%)`);
  }
}
console.log('');
