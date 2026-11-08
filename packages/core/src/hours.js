/**
 * Opening hours, evaluated in the service's own timezone. Pure: the clock and the zone
 * are inputs. Format (a deliberate subset of OSM opening_hours):
 *   "Mo-Fr 09:00-22:00; Sa-Su 09:30-18:00"
 *
 * Whether a line is open is a promise to a person who has just decided to call, so it is
 * only ever shown for a route whose data was verified recently (isRenderableHours), and
 * `null` means "unknown", never "closed".
 */
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function parseHours(spec) {
  if (typeof spec !== 'string' || !spec.trim()) return null;
  const week = Array.from({ length: 7 }, () => []);
  for (const part of spec.split(';')) {
    const m = /^\s*(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})\s*$/.exec(part);
    if (!m) return null;
    const a = DAYS.indexOf(m[1]);
    const b = m[2] ? DAYS.indexOf(m[2]) : a;
    if (b < a) return null;
    const open = Number(m[3]) * 60 + Number(m[4]);
    const close = Number(m[5]) * 60 + Number(m[6]);
    if (open === close || close > 24 * 60 || open > 24 * 60) return null;
    const overnight = close <= open;
    if (overnight && (24 * 60 - open + close) > 12 * 60) return null;
    for (let d = a; d <= b; d++) {
      if (overnight) {
        week[d].push({ open, close: 24 * 60 });
        week[(d + 1) % 7].push({ open: 0, close });
      } else {
        week[d].push({ open, close });
      }
    }
  }
  // Sort intervals per day and return null for empty days as empty array (caller checks length)
  for (let d = 0; d < 7; d++) week[d].sort((a, b) => a.open - b.open);
  return week;
}

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** @returns {null | {open:boolean, opensAt?:string, closesAt?:string}} null = unknown */
export function openStatus(spec, now = new Date(), tz = 'Europe/Amsterdam') {
  const week = parseHours(spec);
  if (!week) return null;
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  } catch { return null; }
  const day = DOW[parts.find((p) => p.type === 'weekday')?.value];
  if (day === undefined) return null;
  const cur = (Number(parts.find((p) => p.type === 'hour').value) % 24) * 60 + Number(parts.find((p) => p.type === 'minute').value);
  const today = week[day];
  if (today.length) {
    for (const iv of today) {
      if (cur >= iv.open && cur < iv.close) return { open: true, closesAt: hhmm(iv.close) };
    }
    // Not open now — check if there's a later opening today (hide day name, same as before)
    for (const iv of today) {
      if (cur < iv.open) return { open: false, opensAt: hhmm(iv.open), opensDay: DAYS[day], tomorrow: true };
    }
  }
  for (let i = 1; i <= 7; i++) {
    const next = week[(day + i) % 7];
    if (next.length) return { open: false, opensAt: hhmm(next[0].open), opensDay: DAYS[(day + i) % 7], tomorrow: i === 1 };
  }
  return { open: false };
}

const MONTH_MS = 30.4375 * 24 * 3.6e6;
/** Hours are shown only for a route verified within the last 12 months. */
export function isRenderableHours(route, now = Date.now()) {
  const t = Date.parse(route?.verifiedAt);
  return Number.isFinite(t) && t <= now && now - t <= 12 * MONTH_MS && !!parseHours(route?.hours);
}
