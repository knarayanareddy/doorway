/**
 * Starter backend for the SBIS widget.
 *
 * GET  /api/config   — module config for a given country + lang
 * POST /api/metrics  — accept module-result events (aggregate only)
 * GET  /api/metrics  — return current aggregates with small-count suppression
 *
 * This is a hackathon starter — not production ready.
 */

import express from 'express';
import { readFile } from 'node:fs/promises';

const app = express();
const PORT = 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());

// CORS — allow localhost dev servers
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.options('*', (_req, res) => res.sendStatus(204));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DATA_DIR = new URL('../data/', import.meta.url);

async function loadJSON(filename) {
  const raw = await readFile(new URL(filename, DATA_DIR), 'utf-8');
  return JSON.parse(raw);
}

const SMALL_COUNT_THRESHOLD = 10;

/** Replace counts below the threshold with null to prevent re-identification. */
function suppress(counts) {
  const out = {};
  let suppressed = false;
  for (const [key, value] of Object.entries(counts)) {
    if (typeof value === 'number' && value < SMALL_COUNT_THRESHOLD) {
      out[key] = null;
      suppressed = true;
    } else {
      out[key] = value;
    }
  }
  return { counts: out, suppressed };
}

// ---------------------------------------------------------------------------
// In-memory metrics store (aggregate counters only — no individual data)
// ---------------------------------------------------------------------------
// Shape:  { [variantId]: { shown: N, dismissed: N, clicked_help: N, … } }
const metrics = {};

function ensureVariant(variantId) {
  if (!metrics[variantId]) {
    metrics[variantId] = {
      shown: 0,
      dismissed: 0,
      clicked_help: 0,
      left_page: 0,
      continued: 0,
      timeout: 0,
    };
  }
  return metrics[variantId];
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/config?country=NL&lang=nl
app.get('/api/config', async (req, res) => {
  try {
    const country = (req.query.country || 'NL').toUpperCase();
    const lang = (req.query.lang || 'en').toLowerCase();

    const [helpServices, messageBlocks] = await Promise.all([
      loadJSON('help-services.json'),
      loadJSON('message-blocks.json'),
    ]);

    const filteredServices = helpServices.filter(
      (s) => s.country === country && s.languages.includes(lang),
    );

    const filteredMessages = messageBlocks.filter((m) => m.lang === lang);

    res.json({
      country,
      language: lang,
      helpServices: filteredServices,
      messageBlocks: filteredMessages,
    });
  } catch (err) {
    console.error('[config]', err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// POST /api/metrics — accept a module-result event
app.post('/api/metrics', (req, res) => {
  const { shown, outcome, timestamp, variantId } = req.body;

  if (typeof shown !== 'boolean' || !outcome || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields: shown, outcome, timestamp' });
  }

  const variant = variantId || '_default';
  const bucket = ensureVariant(variant);
  if (shown) bucket.shown += 1;
  if (bucket[outcome] !== undefined) bucket[outcome] += 1;

  res.json({ ok: true });
});

// GET /api/metrics — return aggregates with suppression
app.get('/api/metrics', (_req, res) => {
  const result = {};
  for (const [variant, counts] of Object.entries(metrics)) {
    const { counts: safeCounts, suppressed } = suppress(counts);
    result[variant] = { counts: safeCounts, suppressedSmallCounts: suppressed };
  }
  res.json(result);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`SBIS starter backend running at http://localhost:${PORT}`);
});
