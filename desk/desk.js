// The Desk. Renders with textContent only. The token lives in memory and is sent
// only to this origin; it is never stored.
const $ = (id) => document.getElementById(id);
const REASONS = ['journalist', 'survivor', 'parent', 'researcher', 'accident', 'other'];
let session = null;

for (const r of REASONS) { const o = document.createElement('option'); o.value = r; o.textContent = r; $('reason').appendChild(o); }

function rows(tbody, items) {
  tbody.replaceChildren();
  for (const cells of items) {
    const tr = document.createElement('tr');
    if (cells.cls) tr.className = cells.cls;
    for (const c of cells.values) { const td = document.createElement('td'); td.textContent = c; if (c === 'hidden (under k)') td.className = 'sup'; tr.appendChild(td); }
    tbody.appendChild(tr);
  }
}
const show = (n) => (n === null || n === undefined ? 'hidden (under k)' : String(n));
const SHAPES = { gate: 'Gate (what is this?)', card: 'Card (why it matters)', hallway: 'Hallway (before you reach out)', door: 'Open door (still open?)', quiet: 'Quiet line', fork: 'Fork (labs)', wave: 'Wave (labs)' };

async function load() {
  $('err').textContent = '';
  const res = await fetch(`/v1/agg?i=${encodeURIComponent(session.i)}&days=${session.days}`, { headers: { authorization: `Bearer ${session.t}` }, credentials: 'omit', cache: 'no-store' });
  if (!res.ok) { $('err').textContent = res.status === 401 ? 'Wrong install id or token.' : 'Could not load numbers.'; $('out').hidden = true; return; }
  const j = await res.json();
  $('out').hidden = false;
  $('label').textContent = j.label;
  const s = j.summary, ct = s.clickThrough;
  $('headline').textContent = s.exposures === null
    ? `Fewer than ${s.k} exposures in this period, so nothing is shown.`
    : `${s.exposures} exposures. Help clicks: ${ct.rate === null ? 'hidden (' + ct.note + ')' : `${ct.clicked} of ${ct.shown} (${(ct.rate * 100).toFixed(1)}%)${ct.note ? ', ' + ct.note : ''}`}.`;
  rows($('outcomes').tBodies[0], s.outcomes.map((c) => ({ values: [c.outcome, show(c.count)] })));
  const byFormat = Array.isArray(j.byFormat) ? j.byFormat : [];
  rows($('shapes').tBodies[0], byFormat.length === 0
    ? [{ values: ['No data in this period.'] }]
    : byFormat.map((f) => ({ values: [SHAPES[f.format] ?? String(f.format), show(f.exposures), show(f.clicked), f.rate === null || f.rate === undefined ? 'hidden (under k)' : `${(f.rate * 100).toFixed(1)}% (${f.clicked} of ${f.exposures})`] })));
  const flaggedBy = Object.fromEntries((s.flaggedDays || []).map((f) => [f.day, f.reasons.join('; ')]));
  rows($('days-table').tBodies[0], j.days.map((d) => ({ cls: d.flagged ? 'flag' : '', values: [d.day, show(d.exposures), d.flagged ? 'unauthenticated: ' + flaggedBy[d.day] : ''] })));
  $('dropped').textContent = j.droppedEvents ? `${j.droppedEvents} events could not be sent, so the counts above may be low.` : 'None reported.';
  rows($('reports').tBodies[0], j.falsePositiveReports.map((r) => ({ values: [r.reason, show(r.count)] })));
}

$('login').addEventListener('submit', (e) => {
  e.preventDefault();
  session = { i: $('inst').value.trim(), t: $('tok').value, days: $('days').value };
  load();
});

$('report').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { i: session.i, p: 'desk', t: $('rtype').value, r: $('reason').value };
  const res = await fetch('/v1/report', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.t}` }, body: JSON.stringify(body), credentials: 'omit' });
  $('rmsg').textContent = res.ok ? 'Recorded.' : 'Could not record.';
  if (res.ok) load();
});
