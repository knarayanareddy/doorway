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
    for (const c of cells.values) { const td = document.createElement('td'); td.textContent = c; if (/^hidden/.test(c)) td.className = 'sup'; tr.appendChild(td); }
    tbody.appendChild(tr);
  }
}
const show = (n) => (n === null || n === undefined ? 'hidden (under k)' : String(n));
const SHAPES = { gate: 'Gate (what is this?)', card: 'Card (why it matters)', hallway: 'Hallway (before you reach out)', door: 'Open door (still open?)', quiet: 'Quiet line', fork: 'Fork (labs)', wave: 'Wave (labs)' };
const OUTCOMES = { clicked_help: 'Asked for help', left_page: 'Left the page', dismissed: 'Dismissed', continued: 'Continued', timeout: 'Timed out' };
const TRIGGERS = { search: 'Search', chat: 'Chat', nav: 'Navigation' };
const WORDING = { control: 'Control wording (offers the way out)', other: 'Other wording' };
const ROUTE_NONE = 'xx-none';
const hiddenText = (k) => `hidden: fewer than ${k}`;
const pct = (f) => (f.rate === null || f.rate === undefined ? null : `${(f.rate * 100).toFixed(1)}% (${f.clicked} of ${f.exposures})`);

/** One breakdown table. Every cell is the server's value; the Desk only words it. */
function breakdown(tbody, items, labelOf, k) {
  rows(tbody, items.length === 0
    ? [{ values: ['No data in this period.'] }]
    : items.map((f) => {
      const hid = (v) => (v === null || v === undefined ? hiddenText(k) : String(v));
      return { values: [labelOf(f.key), hid(f.exposures), hid(f.clicked), pct(f) ?? hiddenText(k)] };
    }));
}

/** Stacked bar from the headline outcomes. Hidden cells are not drawn; they are named under the bar. */
function outcomeBar(outcomes, k) {
  const bar = $('bar');
  bar.replaceChildren();
  const visible = outcomes.filter((c) => !c.suppressed && c.count > 0);
  const total = visible.reduce((a, c) => a + c.count, 0);
  for (const c of visible) {
    const seg = document.createElement('span');
    seg.className = `o-${c.outcome}`;
    seg.style.flexGrow = String(c.count);
    seg.title = `${OUTCOMES[c.outcome] ?? c.outcome}: ${c.count}`;
    bar.appendChild(seg);
  }
  const key = outcomes.map((c) => `${OUTCOMES[c.outcome] ?? c.outcome} ${c.suppressed ? '(' + hiddenText(k) + ')' : c.count}`);
  $('barkey').textContent = total === 0 ? 'No outcomes to show in this period.' : key.join('. ') + '.';
}

/**
 * The adoption ladder. Every rung is read from the same response the rest of the page uses,
 * and a rung is ticked only when its visible numbers prove it. Two rungs the counter cannot see
 * are listed as not measured, and are never ticked.
 */
function ladder(j) {
  const k = j.summary.k;
  const byFormat = Array.isArray(j.byFormat) ? j.byFormat : [];
  const installed = j.summary.exposures !== null && j.summary.exposures > 0;
  const gate = byFormat.some((f) => (f.format === 'gate' || f.format === 'card') && f.exposures !== null && f.exposures > 0);
  const shift = byFormat.length >= 3;
  const measured = [
    { name: 'Installed', done: installed, todo: 'not yet, or fewer than ' + k + ' exposures in this period' },
    { name: 'Gate on', done: gate, todo: 'not yet, or the gate and card counts are hidden under ' + k },
    { name: 'Shift on', done: shift, todo: 'fewer than three shapes seen in this period' },
  ];
  const unmeasured = [
    { name: 'Routes current', why: 'Each route needs a person to check it against the service, and a review date in the routes bundle. The counter sees neither.' },
    { name: 'Glass audited', why: 'Whether someone checked the Glass Door panel against the real request is recorded outside the counter, so the Desk cannot show it.' },
  ];
  $('level').textContent = `Level ${measured.filter((m) => m.done).length} of 3 measured`;
  const list = $('ladder');
  list.replaceChildren();
  for (const m of measured) {
    const li = document.createElement('li');
    li.textContent = `${m.done ? '☑' : '☐'} ${m.name}: ${m.done ? 'done' : m.todo}`;
    list.appendChild(li);
  }
  for (const u of unmeasured) {
    const li = document.createElement('li');
    li.className = 'unmeasured';
    li.textContent = `— ${u.name}: NOT MEASURED BY THE DESK. ${u.why}`;
    list.appendChild(li);
  }
}

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
  outcomeBar(s.outcomes, s.k);
  rows($('outcomes').tBodies[0], s.outcomes.map((c) => ({ values: [c.outcome, show(c.count)] })));
  const byFormat = Array.isArray(j.byFormat) ? j.byFormat : [];
  rows($('shapes').tBodies[0], byFormat.length === 0
    ? [{ values: ['No data in this period.'] }]
    : byFormat.map((f) => ({ values: [SHAPES[f.format] ?? String(f.format), show(f.exposures), show(f.clicked), f.rate === null || f.rate === undefined ? 'hidden (under k)' : `${(f.rate * 100).toFixed(1)}% (${f.clicked} of ${f.exposures})`] })));
  breakdown($('triggers').tBodies[0], j.byTrigger || [], (key) => TRIGGERS[key] ?? String(key), s.k);
  breakdown($('routes').tBodies[0], j.byRoute || [], (key) => (key === ROUTE_NONE ? 'No route shown' : String(key)), s.k);
  breakdown($('escalation').tBodies[0], j.byEscalation || [], (key) => (key === '5+' ? 'Step 5 or more' : `Step ${key}`), s.k);
  breakdown($('arms').tBodies[0], j.variantArms || [], (key) => WORDING[key] ?? String(key), s.k);
  ladder(j);
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
