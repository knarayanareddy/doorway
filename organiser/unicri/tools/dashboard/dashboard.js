// ALL DATA IS SYNTHETIC — see SAFETY.md
// dashboard.js — logic for the synthetic-data dashboard (ES module)

/**
 * Parse JSONL text into an array of event objects.
 * Skips blank lines and lines that fail to parse.
 */
export function parseJsonl(text) {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Group events by variant and count outcomes.
 * Returns: { variantName: { triggers, shown, clicked_help, dismissed, continued, left_page } }
 */
export function aggregateByVariant(events) {
  const result = {};

  for (const e of events) {
    const v = e.variant;
    if (!result[v]) {
      result[v] = { triggers: 0, shown: 0, clicked_help: 0, dismissed: 0, continued: 0, left_page: 0 };
    }
    if (e.event === 'trigger') {
      result[v].triggers++;
    } else if (e.event === 'shown') {
      result[v].shown++;
    } else if (result[v][e.event] !== undefined) {
      result[v][e.event]++;
    }
  }
  return result;
}

/**
 * Replace any count below `threshold` with null (for privacy / small-count suppression).
 * Returns a new object with the same shape.
 */
export function suppressSmallCounts(counts, threshold = 10) {
  const suppressed = {};
  for (const [variant, data] of Object.entries(counts)) {
    suppressed[variant] = {};
    for (const [key, value] of Object.entries(data)) {
      suppressed[variant][key] = typeof value === 'number' && value < threshold ? null : value;
    }
  }
  return suppressed;
}

/**
 * Compute Wilson score confidence interval for a proportion.
 * Returns { lower, upper, center } all in [0, 1].
 */
export function wilsonInterval(successes, total, z = 1.96) {
  if (total === 0) return { lower: 0, upper: 0, center: 0 };

  const p = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)) / denominator;

  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    center,
  };
}

/**
 * Render a funnel bar chart into the given canvas context using Chart.js.
 * `data` should be the output of aggregateByVariant (one variant).
 */
export function renderFunnel(ctx, data, variantName) {
  const labels = ['Triggers', 'Shown', 'Clicked Help', 'Dismissed', 'Continued', 'Left Page'];
  const values = [
    data.triggers,
    data.shown,
    data.clicked_help,
    data.dismissed,
    data.continued,
    data.left_page,
  ];

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: variantName,
          data: values,
          backgroundColor: [
            '#6366f1', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#94a3b8',
          ],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: `Funnel — ${variantName} (SYNTHETIC DATA)` },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
}

/**
 * Render a comparison table into the given container element.
 * `variants` is the output of aggregateByVariant (all variants).
 */
export function renderComparison(container, variants) {
  const suppressed = suppressSmallCounts(variants);
  const variantNames = Object.keys(suppressed);

  const fmt = (v) => (v === null ? '<10' : v);
  const pct = (n, d) => {
    if (n === null || d === null || d === 0) return '—';
    return ((n / d) * 100).toFixed(1) + '%';
  };

  let html = `
    <table>
      <thead>
        <tr>
          <th>Variant</th>
          <th>Triggers</th>
          <th>Shown</th>
          <th>Clicked Help</th>
          <th>Dismissed</th>
          <th>Continued</th>
          <th>Left Page</th>
          <th>Help Click-Through</th>
          <th>95% CI (Wilson)</th>
        </tr>
      </thead>
      <tbody>`;

  for (const name of variantNames) {
    const d = suppressed[name];
    const raw = variants[name];

    // Wilson interval on click-through rate
    const wi = wilsonInterval(raw.clicked_help, raw.triggers);

    const ciText =
      raw.triggers > 0
        ? `[${(wi.lower * 100).toFixed(1)}%, ${(wi.upper * 100).toFixed(1)}%]`
        : '—';

    html += `
        <tr>
          <td><strong>${name}</strong></td>
          <td>${fmt(d.triggers)}</td>
          <td>${fmt(d.shown)}</td>
          <td>${fmt(d.clicked_help)}</td>
          <td>${fmt(d.dismissed)}</td>
          <td>${fmt(d.continued)}</td>
          <td>${fmt(d.left_page)}</td>
          <td>${pct(raw.clicked_help, raw.triggers)}</td>
          <td>${ciText}</td>
        </tr>`;
  }

  html += `
      </tbody>
    </table>
    <p class="ci-explanation">
      <strong>Reading the confidence interval:</strong> The Wilson score interval gives a range
      where we are 95% confident the true click-through rate lies. Narrower intervals mean
      more certainty. If two variants' intervals don't overlap, the difference is likely
      statistically meaningful. All data shown here is <em>synthetic</em> and for
      demonstration purposes only.
    </p>`;

  container.innerHTML = html;
}
