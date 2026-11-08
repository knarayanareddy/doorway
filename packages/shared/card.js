/**
 * @core/card — the shared decision surface.
 *
 * Doorway puts one decision in front of one person at a time: gate, card, hallway or
 * door. Same accessibility requirements and the same one-action rule for each shape.
 * This is the only rendering code the Door uses.
 *
 * Descriptor building and validation are unit-tested. mount() needs a DOM and
 * is verified manually (keyboard-only pass, screen-reader pass, 320px).
 */

export const VARIANTS = Object.freeze(['gate', 'blur', 'card', 'chat', 'hallway', 'door', 'fork', 'wave', 'quiet']);
export const ACTION_KINDS = Object.freeze(['primary', 'secondary', 'dismiss', 'tertiary']);

/*
 * The Wave's curve maths (ported from the preview's Wave.tsx). Pure, so it is unit-tested without a DOM.
 * p is progress through the exercise, 0..1. Elapsed is seconds since the start.
 */
export const WAVE_W = 300;
export const WAVE_H = 90;
export const bell = (x) => Math.exp(-Math.pow((x - 0.42) / 0.22, 2) * (x > 0.42 ? 0.8 : 1.15));
// Pixel point on the SVG for a curve point (x in 0..1, y = bell height in 0..1).
export const wavePixel = (x, y) => [x * WAVE_W, WAVE_H - 8 - y * (WAVE_H - 24)];
export const wavePoints = () => Array.from({ length: 61 }, (_, i) => wavePixel(i / 60, bell(i / 60)));
export const wavePhase = (p) => (p < 0.3 ? 'rise' : p < 0.56 ? 'peak' : 'fall');
export const PHASE_INDEX = Object.freeze({ rise: 0, peak: 1, fall: 2 });
// The filled area under the curve from the start to progress p, closed on the baseline.
export const waveArea = (p) => {
  if (p <= 0) return '';
  const base = WAVE_H - 8;
  const pts = [];
  for (let i = 0; i <= 60; i++) if (i / 60 <= p) pts.push(wavePixel(i / 60, bell(i / 60)));
  pts.push(wavePixel(p, bell(p)));
  const [ex] = pts[pts.length - 1];
  return 'M0,' + base + ' ' + pts.map(([x, y]) => 'L' + x.toFixed(1) + ',' + y.toFixed(1)).join(' ') + ' L' + ex.toFixed(1) + ',' + base + ' Z';
};
export const waveBreathIn = (elapsed) => Math.floor(elapsed / 4) % 2 === 0;
// The orb: 0.8 to 1.14, one full in-and-out every 8 s. Reduced motion holds it at 1.
export const waveOrbScale = (elapsed, reduced = false) => (reduced ? 1 : 0.8 + 0.34 * (0.5 - 0.5 * Math.cos((Math.PI * elapsed) / 4)));

/**
 * Optional content sections, for panels that explain or rehearse something (a disclosure
 * of what is sent, a list of first sentences, an FAQ). Plain data only; every string is
 * escaped on render, so a section can never carry markup.
 *
 *   section = { disclosure: { label, blocks }, placement? }  |  { blocks, placement? }
 *   block   = { type:'text', text } | { type:'heading', text } | { type:'list', items }
 *           | { type:'fields', rows:[{ k, v, note }] }
 *           | { type:'phrases', items, copyLabel, copiedLabel }
 *           | { type:'action', id, label, closes?, onSelect? }
 *   placement = 'content' (between the body and the actions, default) | 'footer'
 */
export const BLOCK_TYPES = Object.freeze(['text', 'heading', 'list', 'fields', 'phrases', 'action', 'choice', 'timer']);

/*
 * More block types:
 *   { type:'choice', id, label?, options:[{id,label}], selected?, onSelect(optionId) }
 *   { type:'timer',  id, seconds, startLabel, remaining(secondsLeft), phases:[{until, label}], doneText, onDone? }
 * A handler (action.onSelect, choice.onSelect, timer.onDone) may return
 *   { view: { headline, body, primary, secondary?, tertiary?, sections? } }   replace the card's content
 *   { message }                                                              say something next to the control
 * `primary`, `secondary` and `tertiary` may carry `outcome` (one of the contract outcomes), which is
 * passed to onOutcome as `hint` so a view can say what its action means.
 */

export function buildCard({
  variant = 'card',
  headline,
  body = '',
  primary,
  secondary = null,
  tertiary = null,
  sections = [],
  closeLabel = 'Close dialog',
  attribution = null,
  footnote = null,
  kicker = null,
  tag = null,
  lang = 'en',
} = {}) {
  const d = {
    variant, lang,
    headline: String(headline ?? '').trim(),
    body: String(body ?? '').trim(),
    primary, secondary, tertiary, sections, closeLabel, attribution, footnote, kicker, tag,
  };
  const v = validate(d);
  if (!v.ok) throw new Error('invalid card: ' + v.errors.join('; '));
  return d;
}

export function validate(d = {}) {
  const errors = [];
  if (!VARIANTS.includes(d.variant)) errors.push('variant must be one of ' + VARIANTS.join('|'));
  if (!d.headline) errors.push('headline is required');
  if (d.headline && d.headline.length > 90) errors.push('headline over 90 chars — will not fit one screen at 320px');
  if (!d.primary || typeof d.primary.label !== 'string' || !d.primary.label.trim()) {
    errors.push('primary action with a label is required');
  }
  if (d.primary && d.primary.kind && !ACTION_KINDS.includes(d.primary.kind)) {
    errors.push('primary.kind must be one of ' + ACTION_KINDS.join('|'));
  }
  if (d.tertiary && (typeof d.tertiary.label !== 'string' || !d.tertiary.label.trim())) errors.push('tertiary action needs a label');
  const secs = d.sections || [];
  if (secs.length > 6) errors.push('at most 6 sections');
  const ids = new Set();
  for (const sec of secs) {
    const blocks = sec.disclosure ? sec.disclosure.blocks : sec.blocks;
    if (sec.disclosure && (typeof sec.disclosure.label !== 'string' || !sec.disclosure.label.trim())) errors.push('disclosure needs a label');
    if (!Array.isArray(blocks) || blocks.length === 0) { errors.push('a section needs blocks'); continue; }
    for (const b of blocks) {
      if (!BLOCK_TYPES.includes(b && b.type)) { errors.push('unknown block type: ' + (b && b.type)); continue; }
      if (b.type === 'action') {
        if (!b.id || !/^[a-z0-9-]{1,24}$/.test(b.id)) errors.push('action block needs a simple id');
        if (ids.has(b.id)) errors.push('duplicate action id: ' + b.id);
        ids.add(b.id);
        if (typeof b.label !== 'string' || !b.label.trim()) errors.push('action block needs a label');
      }
      if (b.type === 'choice') {
        if (!b.id || !/^[a-z0-9-]{1,24}$/.test(b.id)) errors.push('choice block needs a simple id');
        if (ids.has(b.id)) errors.push('duplicate id: ' + b.id);
        ids.add(b.id);
        if (!(Array.isArray(b.options) && b.options.length >= 1 && b.options.length <= 8)) errors.push('choice block needs 1-8 options');
        else for (const o of b.options) if (!o || !/^[a-z0-9-]{1,24}$/.test(o.id) || typeof o.label !== 'string' || !o.label.trim()) errors.push('choice option needs an id and a label');
      }
      if (b.type === 'timer') {
        if (!b.id || !/^[a-z0-9-]{1,24}$/.test(b.id)) errors.push('timer block needs a simple id');
        if (ids.has(b.id)) errors.push('duplicate id: ' + b.id);
        ids.add(b.id);
        if (!(Number.isInteger(b.seconds) && b.seconds >= 5 && b.seconds <= 300)) errors.push('timer seconds must be an integer from 5 to 300');
        if (typeof b.startLabel !== 'string' || !b.startLabel.trim()) errors.push('timer needs a startLabel');
        if (b.curve && !(Array.isArray(b.phases) && b.phases.length === 3 && b.breath && typeof b.breath.in === 'string' && typeof b.breath.out === 'string')) errors.push('curve timer needs three phases and breath.in / breath.out');
      }
      if (b.type === 'list' && !Array.isArray(b.items)) errors.push('list block needs items');
      if (b.type === 'phrases' && !(Array.isArray(b.items) && b.items.length)) errors.push('phrases block needs items');
      if (b.type === 'fields' && !(Array.isArray(b.rows) && b.rows.length)) errors.push('fields block needs rows');
    }
  }
  if (d.body && d.body.length > 420) errors.push('body over 420 chars — will need scrolling');
  return { ok: errors.length === 0, errors };
}

/**
 * Mount into a shadow root so a host page's CSS cannot break the card and the
 * card cannot break the host. Returns { el, close, outcome }.
 */
export function mount(d0, { onOutcome, doc = globalThis.document } = {}) {
  let d = d0;
  const host = doc.createElement('div');
  host.setAttribute('data-core-card', d.variant);
  doc.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = CSS;
  root.appendChild(style);

  const wrap = doc.createElement('div');
  wrap.className = d.variant === 'quiet' ? 'quiet' : 'ovl';
  wrap.innerHTML = render(d);
  root.appendChild(wrap);

  // Focusable controls are looked up when a key is pressed, not once at mount: sections can
  // reveal buttons later, and a stale list would let Tab skip them or trap focus too early.
  const focusables = () => [...root.querySelectorAll('button, a[data-act]')].filter((b) => !b.closest('[hidden]'));
  const buttons = focusables();
  const primary = root.querySelector('[data-act="primary"]');
  const prev = doc.activeElement;
  let outcome = 'timeout';
  let action = null;
  const timers = new Set();
  // The Wave's animation frame, when one is running. Stopped with the timers, so a view change or close ends it.
  let stopFrames = () => {};
  const stopTimers = () => { timers.forEach(clearInterval); timers.clear(); stopFrames(); stopFrames = () => {}; };

  let closed = false;
  // Escape is listened for on the document, not inside the card: Safari does not focus a button when it is
  // clicked, so after a click the keyboard focus is on the page body and a handler inside the card never sees the key.
  const onDocKey = (e) => { if (e.key === 'Escape') finish('dismiss'); };
  doc.addEventListener('keydown', onDocKey);
  const close = () => {
    if (closed) return;
    closed = true;
    doc.removeEventListener('keydown', onDocKey);
    stopTimers();
    host.remove();
    if (prev && prev.focus) prev.focus();
    if (onOutcome) onOutcome({ outcome, variant: d.variant, hint: (action && action.outcome) || null, action });
  };
  const finish = (o, a = null) => { if (outcome === 'timeout') { outcome = o; action = a; } close(); };

  // Replace the card's content in place (the Fork's paths). The shadow root, the focus trap and the
  // delegated handlers stay; timers from the old view stop.
  const setView = (patch) => {
    stopTimers();
    d = buildCard({ ...d, ...patch });
    wrap.innerHTML = render(d);
    const f = root.querySelector('[data-act="primary"]') || focusables()[0];
    if (f) f.focus();
  };

  const findBlock = (id) => {
    for (const sec of d.sections || []) for (const b of (sec.disclosure ? sec.disclosure.blocks : sec.blocks)) if (b.id === id) return b;
    return null;
  };
  const answer = (r, t) => {
    if (r && r.view) { setView(r.view); return; }
    const status = t.closest('.ar, .ch') && t.closest('.ar, .ch').querySelector('.astat');
    if (status) status.textContent = (r && r.message) || '';
  };

  // One delegated handler. Report BEFORE acting: a primary action is usually a navigation, and a
  // navigation that unloads the page swallows both the outcome callback and the counter beacon,
  // which silently deletes the one number the whole product is measured on. The order is load-bearing.
  // The Door's call button is a real tel: link (a href, not a URL the Door opens), so it is the one anchor
  // that counts as an action. It reports like any primary; its navigation is left to the browser.
  root.addEventListener('click', (e) => {
    const t = e.target.closest ? e.target.closest('button, a[data-act]') : null;
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'primary' || act === 'secondary' || act === 'tertiary') {
      const a = d[act];
      finish(act, a);
      if (a && a.onSelect) a.onSelect();
    } else if (act === 'dismiss') {
      finish('dismiss');
    } else if (t.dataset.disc) {
      const body = root.getElementById ? root.getElementById(t.dataset.disc) : root.querySelector('#' + t.dataset.disc);
      const open = t.getAttribute('aria-expanded') === 'true';
      t.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (body) body.hidden = open;
    } else if (t.dataset.copyText !== undefined) {
      copyText(doc, t.dataset.copyText);
      const original = t.dataset.label;
      t.textContent = t.dataset.done || original;
      setTimeout(() => { t.textContent = original; }, 1800);
    } else if (t.dataset.sect) {
      const b = findBlock(t.dataset.sect);
      if (!b) return;
      // The action runs first: it may navigate the host (quick exit) or open help, and finish() can settle the
      // Door, after which the loader removes this frame and a navigation it started could be cancelled.
      // A closing action whose handler returns a view stays open and shows that view (a quick exit the browser refused).
      if (b.closes) {
        let r = null;
        try { r = b.onSelect ? b.onSelect() : null; } finally { if (!(r && r.view)) finish('section:' + b.id, b); }
        if (r && r.view) answer(r, t);
      } else answer(b.onSelect ? b.onSelect() : null, t);
    } else if (t.dataset.choice) {
      const b = findBlock(t.dataset.choice);
      const o = b && (b.options || []).find((x) => x.id === t.dataset.opt);
      if (!o) return;
      const r = b.onSelect ? b.onSelect(o.id) : null;
      if (!(r && r.view)) t.parentElement.querySelectorAll('.cb').forEach((x) => x.setAttribute('aria-pressed', x === t ? 'true' : 'false'));
      answer(r, t);
    } else if (t.dataset.timer) {
      const b = findBlock(t.dataset.timer);
      if (!b) return;
      const box = t.closest('.tm');
      const bar = box.querySelector('progress');
      const label = box.querySelector('.tl');
      const phase = box.querySelector('.tp');
      const done = box.querySelector('.td');
      const total = b.seconds;
      let left = total;
      // The button the person just pressed is about to disappear. Move focus to the status line first,
      // otherwise focus falls out of the card and Escape and Tab stop working for keyboard users.
      phase.setAttribute('tabindex', '-1');
      t.hidden = true;
      phase.focus();
      // The Wave (curve): the picture follows the clock. Motion (the moving dot, the orb) runs per animation frame;
      // reduced motion keeps the picture still and only redraws it once a second, with the countdown.
      const curve = !!b.curve;
      const reduced = !!(doc.defaultView && doc.defaultView.matchMedia && doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const t0 = performance.now();
      const elapsed = () => (reduced ? total - left : Math.min(total, (performance.now() - t0) / 1000));
      const svg = box.querySelector('.wv-curve');
      const dot = box.querySelector('.wv-dot');
      const area = box.querySelector('.wv-area');
      const disc = box.querySelector('.wv-disc');
      const orbLabel = box.querySelector('.wv-lab');
      const drawWave = (e = elapsed()) => {
        const p = Math.min(1, e / total);
        const [x, y] = wavePixel(p, bell(p));
        dot.setAttribute('cx', x.toFixed(1));
        dot.setAttribute('cy', y.toFixed(1));
        area.setAttribute('d', waveArea(p));
        disc.style.transform = 'scale(' + waveOrbScale(e, reduced).toFixed(3) + ')';
        const breath = b.breath[waveBreathIn(e) ? 'in' : 'out'];
        if (orbLabel.textContent !== breath) orbLabel.textContent = breath;
        const ph = b.phases[PHASE_INDEX[wavePhase(p)]].label;
        if (phase.textContent !== ph) { phase.textContent = ph; svg.setAttribute('aria-label', ph); }
      };
      const paint = () => {
        const frac = (total - left) / total;
        bar.value = total - left;
        label.textContent = b.remaining ? b.remaining(left) : String(left);
        if (curve) { drawWave(); return; }
        const ph = (b.phases || []).find((x) => frac < x.until) || (b.phases || [])[(b.phases || []).length - 1];
        if (ph) phase.textContent = ph.label;
      };
      paint();
      if (curve && !reduced) {
        let raf = 0;
        const frame = () => { drawWave(); raf = requestAnimationFrame(frame); };
        raf = requestAnimationFrame(frame);
        stopFrames = () => cancelAnimationFrame(raf);
      }
      const id = setInterval(() => {
        left -= 1;
        if (left > 0) { paint(); return; }
        clearInterval(id); timers.delete(id);
        if (curve) { stopFrames(); stopFrames = () => {}; drawWave(total); disc.style.transform = 'scale(1)'; orbLabel.textContent = ''; }
        bar.value = total; label.textContent = ''; phase.textContent = '';
        done.textContent = b.doneText || '';
        if (b.onDone) answer(b.onDone(), t);
      }, 1000);
      timers.add(id);
    }
  });

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (list.length === 0) return;
    const i = list.indexOf(root.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
    else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus(); }
  });

  setTimeout(() => { const f = primary || buttons[0]; if (f) f.focus({ preventScroll: true }); }, 30);

  // Auto-dismiss with pause on hover/focus per WCAG 2.2.1
  if (d.variant === 'quiet') {
    let timer = null;
    let remaining = 9000;
    let start = Date.now();

    const startTimer = () => {
      start = Date.now();
      timer = setTimeout(() => { if (host.isConnected) close(); }, remaining);
    };

    const pauseTimer = () => {
      if (timer) clearTimeout(timer);
      remaining = Math.max(0, remaining - (Date.now() - start));
    };

    if (wrap.addEventListener) {
      wrap.addEventListener('mouseenter', pauseTimer);
      wrap.addEventListener('mouseleave', () => { if (remaining > 0) startTimer(); });
      wrap.addEventListener('focusin', pauseTimer);
      wrap.addEventListener('focusout', () => { if (remaining > 0) startTimer(); });
    }

    startTimer();
  }

  return { el: host, close, outcome: () => outcome };
}

function copyText(doc, text) {
  try {
    const nav = doc.defaultView && doc.defaultView.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) { nav.clipboard.writeText(text).catch(() => legacyCopy(doc, text)); return; }
  } catch (e) { /* fall through */ }
  legacyCopy(doc, text);
}
function legacyCopy(doc, text) {
  const ta = doc.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  doc.body.appendChild(ta); ta.select();
  try { doc.execCommand('copy'); } catch (e) { /* nothing more to try */ }
  ta.remove();
}

let uid = 0;
// The Wave's live picture: the urge curve (faint full line, filled area to progress, a dot), the breathing orb
// (a disc whose scale is set from the clock) and its label, which sits under the orb, not on it, so it keeps contrast.
function waveMarkup(b) {
  const pts = wavePoints().map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');
  const [dx, dy] = wavePixel(0, bell(0));
  return '<svg class="wv-curve" viewBox="0 0 ' + WAVE_W + ' ' + WAVE_H + '" role="img" aria-label="' + esc(b.phases[0].label) + '" focusable="false">' +
    '<polyline class="wv-line" points="' + pts + '" fill="none" stroke="rgba(247,242,232,0.25)" stroke-width="2" stroke-linecap="round"/>' +
    '<path class="wv-area" d="" fill="rgba(232,163,61,0.28)"/>' +
    '<circle class="wv-dot" cx="' + dx.toFixed(1) + '" cy="' + dy.toFixed(1) + '" r="5.5" fill="#e8a33d" stroke="#0e1a24" stroke-width="2"/></svg>' +
    '<div class="wv-orb" aria-hidden="true"><div class="wv-disc"></div></div>' +
    '<div class="wv-lab" aria-hidden="true">' + esc(b.breath.in) + '</div>';
}
function renderBlock(b) {
  switch (b.type) {
    case 'text': return '<p class="bt">' + esc(b.text) + '</p>';
    case 'heading': return '<h3 class="bh">' + esc(b.text) + '</h3>';
    case 'list': return '<ul class="bl">' + b.items.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul>';
    case 'fields': return '<dl class="bf">' + b.rows.map((r) => '<div><dt><code>' + esc(r.k) + '</code></dt><dd>' + esc(r.v) + (r.note ? '<small>' + esc(r.note) + '</small>' : '') + '</dd></div>').join('') + '</dl>';
    case 'phrases': return '<ul class="ph">' + b.items.map((i) =>
      '<li><span>' + esc(i) + '</span><button class="cp" data-copy-text="' + esc(i) + '" data-label="' + esc(b.copyLabel || 'Copy') + '" data-done="' + esc(b.copiedLabel || '') + '">' + esc(b.copyLabel || 'Copy') + '</button></li>').join('') + '</ul>';
    case 'choice': return '<div class="ch">' + (b.label ? '<p class="bt">' + esc(b.label) + '</p>' : '') + '<div class="co">' +
      b.options.map((o) => '<button class="cb" data-choice="' + esc(b.id) + '" data-opt="' + esc(o.id) + '" aria-pressed="' + (b.selected === o.id ? 'true' : 'false') + '">' + esc(o.label) + '</button>').join('') +
      '</div><span class="astat" role="status" aria-live="polite"></span></div>';
    case 'timer': return '<div class="tm' + (b.curve ? ' wv' : '') + '"><button class="sa" data-timer="' + esc(b.id) + '">' + esc(b.startLabel) + '</button>' +
      (b.curve ? waveMarkup(b) : '') +
      '<progress class="tpg" max="' + b.seconds + '" value="0" aria-hidden="true"></progress>' +
      (b.curve
        ? '<div class="tl" role="status" aria-live="polite"></div>'
        : '<div class="tl" aria-hidden="true"></div>') +
      '<div class="tp" role="status" aria-live="polite"></div><div class="td" role="status" aria-live="polite"></div></div>';
    case 'action': return '<div class="ar"><button class="sa' + (b.tone === 'danger' ? ' danger' : '') + '" data-sect="' + esc(b.id) + '">' + esc(b.label) + '</button><span class="astat" role="status" aria-live="polite"></span></div>';
    default: return '';
  }
}
function renderSections(list, placement) {
  return (list || []).filter((s) => (s.placement || 'content') === placement).map((s) => {
    if (s.disclosure) {
      const id = 'dsc' + (uid++);
      return '<div class="disc"><button class="dt" data-disc="' + id + '" aria-expanded="false" aria-controls="' + id + '">' + esc(s.disclosure.label) + '<span class="chev" aria-hidden="true">\u25be</span></button>' +
        '<div class="dbody" id="' + id + '" hidden>' + s.disclosure.blocks.map(renderBlock).join('') + '</div></div>';
    }
    return '<div class="blocks">' + s.blocks.map(renderBlock).join('') + '</div>';
  }).join('');
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// A plain door, drawn with stroke only: the icon tile of the Door panel. Static markup, no script, no style attribute.
const DOOR_ICON = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  '<path d="M4 21V5a2 2 0 0 1 2-2h8v18"/><path d="M14 3l5 2.5V21"/><path d="M3 21h18"/><path d="M11 12h.01"/></svg>';

/** The Door shape (exposure 5+): a wide dark panel. Same actions and the same ids as every other shape. */
function renderDoor(d) {
  const top = d.attribution ? '<span class="attr">' + esc(d.attribution) + '</span>' : '<span></span>';
  const close = '<button class="x" data-act="dismiss" aria-label="' + esc(d.closeLabel || 'Close dialog') + '">\u00d7</button>';
  const cta = d.primary.href
    ? '<a class="cta" data-act="primary" href="' + esc(d.primary.href) + '">' + esc(d.primary.label) + '</a>'
    : '<button class="cta" data-act="primary">' + esc(d.primary.label) + '</button>';
  const carry = d.secondary ? '<button class="carry" data-act="secondary">' + esc(d.secondary.label) + '</button>' : '';
  const rep = d.tertiary ? '<button class="rep" data-act="tertiary">' + esc(d.tertiary.label) + '</button>' : '';
  const kicker = d.kicker ? '<p class="drk">' + esc(d.kicker) + (d.tag ? '<span class="drg">' + esc(d.tag) + '</span>' : '') + '</p>' : '';
  const body = d.body ? '<p class="drb">' + esc(d.body) + '</p>' : '';
  return '<div role="dialog" aria-modal="true" aria-labelledby="doorway-card-title" class="dr">' +
    '<div class="bar">' + top + close + '</div>' + renderSections(d.sections, 'top') +
    '<div class="drm"><div class="drt">' + DOOR_ICON + '</div><div class="drc">' + kicker +
    '<h2 id="doorway-card-title">' + esc(d.headline) + '</h2>' + body + '</div></div>' +
    '<div class="dra">' + cta + renderSections(d.sections, 'content') + '</div>' +
    renderSections(d.sections, 'footer') +
    '<div class="drf">' + carry + rep + '</div>' +
    (d.footnote ? '<p class="conf">' + esc(d.footnote) + '</p>' : '') + '</div>';
}

export function render(d) {
  if (d.variant === 'quiet') {
    return '<div role="status" aria-live="polite" class="quiet-text">' + esc(d.body || d.headline) + '</div>';
  }
  if (d.variant === 'door') return renderDoor(d);
  const attr = d.attribution
    ? '<div class="bar"><span class="attr">' + esc(d.attribution) + '</span>' +
      '<button class="x" data-act="dismiss" aria-label="' + esc(d.closeLabel || 'Close dialog') + '">\u00d7</button></div>'
    : '<div class="bar"><span></span><button class="x" data-act="dismiss" aria-label="' + esc(d.closeLabel || 'Close dialog') + '">\u00d7</button></div>';
  const topSections = renderSections(d.sections, 'top');
  const sec = d.secondary ? '<button class="alt" data-act="secondary">' + esc(d.secondary.label) + '</button>' : '';
  const rep = d.tertiary ? '<button class="rep" data-act="tertiary">' + esc(d.tertiary.label) + '</button>' : '';
  const foot = d.footnote ? '<p class="conf">' + esc(d.footnote) + '</p>' : '';
  const labelledBy = d.headline ? ' aria-labelledby="doorway-card-title"' : '';
  return '<div role="dialog" aria-modal="true"' + labelledBy + '>' + attr + topSections +
    (d.headline ? '<h2 id="doorway-card-title">' + esc(d.headline) + '</h2>' : '') +
    (d.body ? '<p>' + esc(d.body) + '</p>' : '') +
    renderSections(d.sections, 'content') +
    '<button class="cta" data-act="primary">' + esc(d.primary.label) + '</button>' +
    sec + rep + renderSections(d.sections, 'footer') + foot + '</div>';
}

export const CSS = [
  ':host{all:initial}',
  '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
  // One palette for every shape (the Door preview's index.css tokens): night card, paper text, lamp accent.
  // Shapes differ by silhouette and layout only (the per-shape block below), never by colour family.
  '.ovl{position:fixed;inset:0;background:rgba(14,26,36,.72);z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:0}',
  '@media(min-width:560px){.ovl{align-items:center;padding:24px}}',
  '.ovl>div{background:#0e1a24;color:#f7f2e8;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:16px 16px 0 0;padding:24px 22px 18px;box-shadow:0 30px 80px -30px rgba(14,26,36,.9);border:1px solid rgba(247,242,232,.1)}',
  '@media(min-width:560px){.ovl>div{border-radius:16px}}',
  '.bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}',
  '.attr{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(247,242,232,.6);font-weight:700}',
  '.x{background:none;border:0;font-size:24px;line-height:1;color:rgba(247,242,232,.6);cursor:pointer;padding:6px 10px;border-radius:6px;min-width:44px;min-height:44px}',
  '.x:focus-visible{outline:3px solid #e8a33d;outline-offset:2px}',
  'h2{font-family:Georgia,serif;font-size:22px;line-height:1.25;margin:0 0 10px;font-weight:500;color:#f7f2e8}',
  'p{font-size:15px;line-height:1.5;margin:0 0 12px;color:rgba(247,242,232,.85)}',
  '.cta{display:block;width:100%;background:#e8a33d;color:#0e1a24;border:0;border-radius:12px;font-size:16px;font-weight:650;padding:15px 16px;margin-top:16px;cursor:pointer;min-height:48px}',
  '.cta:focus-visible{outline:3px solid #f7f2e8;outline-offset:2px}',
  '.alt{display:block;width:100%;background:rgba(247,242,232,.08);border:1px solid rgba(247,242,232,.3);border-radius:12px;font-size:16px;font-weight:650;color:#f7f2e8;padding:13px 16px;margin-top:12px;cursor:pointer;min-height:48px}',
  '.alt:focus-visible{outline:3px solid #f7f2e8;outline-offset:2px}',
  '.rep{display:block;margin:14px auto 0;background:none;border:0;padding:12px 8px;min-height:44px;font-size:14px;color:#e8a33d;text-decoration:underline;cursor:pointer}',
  '.rep:focus-visible{outline:3px solid #f7f2e8;outline-offset:2px}',
  '.disc{margin-top:12px;border-top:1px solid rgba(247,242,232,.14)}',
  '.dt{display:flex;width:100%;justify-content:space-between;align-items:center;background:none;border:0;padding:12px 2px;min-height:44px;font-size:14px;font-weight:600;color:#e8a33d;cursor:pointer;text-align:left}',
  '.dt:focus-visible,.sa:focus-visible,.cp:focus-visible{outline:3px solid #f7f2e8;outline-offset:2px}',
  '.dt[aria-expanded="true"] .chev{transform:rotate(180deg)}',
  '.dbody{padding:0 2px 8px}',
  '.bt{font-size:14px;line-height:1.5;margin:0 0 10px;color:rgba(247,242,232,.85)}',
  '.bh{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#e8a33d;margin:14px 0 6px}',
  '.bl{margin:0 0 10px;padding-left:18px;font-size:14px;line-height:1.5;color:rgba(247,242,232,.85)}',
  '.bf{margin:0 0 10px;font-size:13px}.bf>div{padding:7px 0;border-bottom:1px solid rgba(247,242,232,.12)}.bf dt{margin:0}.bf dd{margin:2px 0 0;color:rgba(247,242,232,.85);overflow-wrap:anywhere}.bf small{display:block;color:rgba(247,242,232,.6);font-size:12px;margin-top:2px}',
  '.bf code{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;color:#e8a33d}',
  '.ph{list-style:none;margin:0 0 10px;padding:0}.ph li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:9px 10px;margin-bottom:6px;border:1px solid rgba(247,242,232,.2);border-radius:12px;font-size:14px;color:#f7f2e8}',
  '.cp,.sa{background:none;border:1px solid #e8a33d;color:#e8a33d;border-radius:8px;font-size:13px;font-weight:600;padding:8px 10px;min-height:44px;cursor:pointer;white-space:nowrap}',
  '.sa.danger{background:#f6dcd3;border-color:#f6dcd3;color:#0e1a24}',
  '.ar{display:flex;gap:10px;align-items:center;margin:6px 0 10px;flex-wrap:wrap}.astat{font-size:12px;color:rgba(247,242,232,.6)}',
  '.co{display:flex;flex-direction:column;gap:8px;margin:6px 0 8px}',
  '.cb{display:block;width:100%;text-align:left;background:#162836;border:1px solid rgba(247,242,232,.22);color:#f7f2e8;border-radius:12px;font-size:15px;padding:12px 14px;min-height:48px;cursor:pointer}',
  '.cb[aria-pressed="true"]{border-color:#e8a33d;background:rgba(232,163,61,.16);font-weight:650}',
  '.cb:focus-visible{outline:3px solid #f7f2e8;outline-offset:2px}',
  '.tm{margin:6px 0 10px}.tpg{display:block;width:100%;height:10px;margin:10px 0 6px;accent-color:#e8a33d}',
  '.tp:focus{outline:none}',
  '.tl{font-size:13px;color:rgba(247,242,232,.6);min-height:18px}.tp{font-size:15px;font-weight:650;color:#f7f2e8;min-height:22px}.td{font-size:14px;color:rgba(247,242,232,.85)}',
  '.conf{font-size:12px;color:rgba(247,242,232,.6);margin-top:14px;border-top:1px solid rgba(247,242,232,.14);padding-top:11px}',
  '.quiet{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);background:#26241f;color:#f5f1e8;font-size:13px;padding:11px 16px;border-radius:999px;z-index:2147483000;max-width:92vw}',
  // Per-shape silhouettes. One palette (night, paper, lamp) for every shape; a shape changes only its layout:
  // header treatment, radius, where the lamp accent sits, and how choices, phrases and the timer are arranged.
  '@keyframes wv-breathe{0%,100%{transform:scale(.92)}50%{transform:scale(1.06)}}',
  // GATE: the serious one. Square corners, a full-width lamp rule across the top, a large headline, square buttons.
  ':host([data-core-card="gate"]) .ovl>div{border-radius:4px;border-top:4px solid #e8a33d;padding:30px 26px 22px}',
  ':host([data-core-card="gate"]) h2{font-size:30px;line-height:1.18;margin-bottom:14px}',
  ':host([data-core-card="gate"]) p{font-size:16px}',
  ':host([data-core-card="gate"]) .cta,:host([data-core-card="gate"]) .alt{border-radius:4px}',
  // CARD: the harm warning. Soft round corners and a pause motif (two lamp bars) above the headline; pill buttons.
  ':host([data-core-card="card"]) .ovl>div{border-radius:28px;padding:26px 26px 20px}',
  ':host([data-core-card="card"]) h2::before{content:"";display:block;width:18px;height:20px;margin-bottom:14px;background:linear-gradient(to right,#e8a33d 0 6px,transparent 6px 12px,#e8a33d 12px 18px)}',
  ':host([data-core-card="card"]) .cta,:host([data-core-card="card"]) .alt{border-radius:999px}',
  // FORK: the crossroads. The choices become a two-column grid of tiles; the primary action sits below them.
  ':host([data-core-card="fork"]) .ovl>div{border-radius:18px}',
  ':host([data-core-card="fork"]) .co{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
  ':host([data-core-card="fork"]) .cb{display:flex;align-items:center;justify-content:center;text-align:center;min-height:96px;padding:12px;font-size:15px;line-height:1.3;border-radius:14px}',
  ':host([data-core-card="fork"]) .cb[aria-pressed="true"]{box-shadow:inset 0 3px 0 #e8a33d}',
  '@media(max-width:359px){:host([data-core-card="fork"]) .co{grid-template-columns:1fr}}',
  // WAVE: calm and centred. A large countdown ring that breathes, a lamp progress line under it, very round corners.
  ':host([data-core-card="wave"]) .ovl>div{border-radius:32px;text-align:center;padding:28px 24px 22px}',
  ':host([data-core-card="wave"]) h2{text-align:center}',
  ':host([data-core-card="wave"]) .tm{display:flex;flex-direction:column;align-items:center;margin:4px 0 8px}',
  ':host([data-core-card="wave"]) .tl{order:-1;flex:none;width:min(176px,38vh);height:min(176px,38vh);border-radius:50%;border:6px solid #e8a33d;display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:300;color:#f7f2e8;font-variant-numeric:tabular-nums;margin:6px 0 12px;animation:wv-breathe 8s ease-in-out infinite;min-height:0}',
  ':host([data-core-card="wave"]) .tpg{width:100%}',
  // The Wave's curve and breathing orb (a timer block with curve: true). Its countdown is plain text, not the ring.
  ':host([data-core-card="wave"]) .tm.wv .tl{order:0;flex:none;width:auto;height:auto;border:0;border-radius:0;animation:none;margin:6px 0 0;font-size:14px;min-height:18px}',
  '.wv-curve{display:block;width:100%;max-width:300px;height:auto;margin:8px auto 0;overflow:visible}',
  '.wv-orb{position:relative;width:112px;height:112px;margin:6px auto 0;display:grid;place-items:center}',
  '.wv-disc{width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#f7cf86,#e8a33d);box-shadow:0 0 36px rgba(232,163,61,.45)}',
  '.wv-lab{font-size:13px;font-weight:600;color:#f7f2e8;margin-top:4px;min-height:18px}',
  // HALLWAY: a door ajar. A lamp light edge down the left side; the phrases are chat bubbles with their copy buttons.
  ':host([data-core-card="hallway"]) .ovl>div{border-radius:16px;padding-left:34px;position:relative}',
  ':host([data-core-card="hallway"]) .ovl>div::before{content:"";position:absolute;left:12px;top:24px;bottom:24px;width:4px;border-radius:2px;background:linear-gradient(#e8a33d,rgba(232,163,61,0))}',
  ':host([data-core-card="hallway"]) .ph{display:flex;flex-direction:column;align-items:flex-start;gap:8px}',
  ':host([data-core-card="hallway"]) .ph li{max-width:92%;background:#162836;border-color:transparent;border-radius:18px 18px 18px 4px;padding:12px 12px 12px 14px}',
  // The Door panel: night background, a lamp glow on the left, a door tile. Stroke-only icon, no images, no web fonts.
  '.ovl>div.dr{position:relative;background:#0e1a24;color:#f5f1e8;max-width:560px;padding:20px 22px 14px;box-shadow:0 8px 40px rgba(0,0,0,.45)}',
  '.dr::before{content:"";position:absolute;left:-40px;top:0;height:100%;width:50%;background:linear-gradient(to right,rgba(232,163,61,.2),transparent);pointer-events:none}',
  '.dr>*{position:relative}',
  '.dr .attr{color:#a79f94;font-size:12px;font-weight:400;letter-spacing:0;text-transform:none;line-height:1.4}',
  '.dr .x{color:#a79f94}',
  '.dr h2{color:#f5f1e8;font-size:21px;margin:0}',
  '.drm{display:flex;gap:16px;align-items:flex-start}',
  '.drt{flex:0 0 56px;width:56px;height:56px;border-radius:12px;background:rgba(232,163,61,.15);color:#e8a33d;display:grid;place-items:center}',
  '.drc{flex:1;min-width:0}',
  '.drk{font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#e8a33d;margin:0 0 6px}',
  '.drg{display:inline-block;margin-left:8px;padding:1px 7px;border:1px solid #e8a33d;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:.02em;text-transform:none;color:#e8a33d}',
  '.drb{font-size:14px;color:rgba(245,241,232,.78);margin:6px 0 0}',
  '.dra{display:flex;flex-direction:column;gap:10px;margin-top:16px}',
  '.dr .cta{display:flex;align-items:center;justify-content:center;margin:0;text-decoration:none;text-align:center;background:#e8a33d;color:#0e1a24;min-height:48px;padding:14px 16px;font-size:16px}',
  '.dr .cta:focus-visible,.dr .carry:focus-visible,.dr .dt:focus-visible,.dr .sa:focus-visible,.dr .rep:focus-visible,.dr .x:focus-visible{outline:3px solid #f5f1e8;outline-offset:2px}',
  '.dr .ar{margin:0;justify-content:center}',
  '.dra .sa:not(.danger){background:none;border-color:transparent;color:#e8a33d;text-decoration:underline;text-underline-offset:4px;padding:10px 12px}',
  '.dr .sa{background:none;border-color:#e8a33d;color:#e8a33d}',
  '.dr .sa.danger{background:#b4573f;border-color:#b4573f;color:#fff}',
  '.dr .disc{margin-top:14px;border-top:1px solid rgba(255,255,255,.12)}',
  '.dr .dt{color:#e8a33d}',
  '.dr .dbody{color:#e6e0d3}.dr .dbody .bt,.dr .dbody .bl{color:#e6e0d3}.dr .dbody .bh{color:#a79f94}',
  '.dr .bf>div{border-color:rgba(255,255,255,.12)}.dr .bf dd{color:#e6e0d3}.dr .bf small{color:#a79f94}.dr .bf code{color:#e8a33d}',
  '.dr .drf{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12)}',
  '.dr .carry{background:none;border:1px solid rgba(245,241,232,.3);border-radius:8px;color:#f5f1e8;font-size:13px;font-weight:600;padding:10px 12px;min-height:44px;cursor:pointer}',
  '.dr .rep{margin:0;padding:10px 8px;min-height:44px;color:#e8a33d}',
  '.dr .conf{color:#a79f94;border-color:rgba(255,255,255,.12)}',
  '@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}',
].join('\n');
