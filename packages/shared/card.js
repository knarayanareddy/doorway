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
  lang = 'en',
} = {}) {
  const d = {
    variant, lang,
    headline: String(headline ?? '').trim(),
    body: String(body ?? '').trim(),
    primary, secondary, tertiary, sections, closeLabel, attribution, footnote,
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
  const focusables = () => [...root.querySelectorAll('button')].filter((b) => !b.closest('[hidden]'));
  const buttons = focusables();
  const primary = root.querySelector('[data-act="primary"]');
  const prev = doc.activeElement;
  let outcome = 'timeout';
  let action = null;
  const timers = new Set();
  const stopTimers = () => { timers.forEach(clearInterval); timers.clear(); };

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
  root.addEventListener('click', (e) => {
    const t = e.target.closest ? e.target.closest('button') : null;
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
      if (b.closes) { finish('section:' + b.id, b); if (b.onSelect) b.onSelect(); }
      else answer(b.onSelect ? b.onSelect() : null, t);
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
      const paint = () => {
        const frac = (total - left) / total;
        bar.value = total - left;
        label.textContent = b.remaining ? b.remaining(left) : String(left);
        const ph = (b.phases || []).find((x) => frac < x.until) || (b.phases || [])[(b.phases || []).length - 1];
        if (ph) phase.textContent = ph.label;
      };
      paint();
      const id = setInterval(() => {
        left -= 1;
        if (left > 0) { paint(); return; }
        clearInterval(id); timers.delete(id);
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

  setTimeout(() => { const f = primary || buttons[0]; if (f) f.focus(); }, 30);

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
    case 'timer': return '<div class="tm"><button class="sa" data-timer="' + esc(b.id) + '">' + esc(b.startLabel) + '</button>' +
      '<progress class="tpg" max="' + b.seconds + '" value="0" aria-hidden="true"></progress>' +
      '<div class="tl" aria-hidden="true"></div><div class="tp" role="status" aria-live="polite"></div><div class="td" role="status" aria-live="polite"></div></div>';
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

function render(d) {
  if (d.variant === 'quiet') {
    return '<div role="status" aria-live="polite" class="quiet-text">' + esc(d.body || d.headline) + '</div>';
  }
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

const CSS = [
  ':host{all:initial}',
  '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
  '.ovl{position:fixed;inset:0;background:rgba(20,18,16,.72);z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:0}',
  '@media(min-width:560px){.ovl{align-items:center;padding:24px}}',
  '.ovl>div{background:#fff;color:#1b1a18;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:14px 14px 0 0;padding:24px 22px 18px;box-shadow:0 8px 40px rgba(0,0,0,.35)}',
  '@media(min-width:560px){.ovl>div{border-radius:14px}}',
  '.bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}',
  '.attr{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#6d665e;font-weight:700}',
  '.x{background:none;border:0;font-size:24px;line-height:1;color:#9a938a;cursor:pointer;padding:6px 10px;border-radius:6px}',
  '.x:focus-visible{outline:3px solid #1f4e79;outline-offset:2px}',
  'h2{font-family:Georgia,serif;font-size:20px;line-height:1.25;margin:0 0 10px;font-weight:600}',
  'p{font-size:15px;line-height:1.5;margin:0 0 12px;color:#3d3934}',
  '.cta{display:block;width:100%;background:#1f4e79;color:#fff;border:0;border-radius:9px;font-size:16px;font-weight:650;padding:15px 16px;margin-top:16px;cursor:pointer;min-height:48px}',
  '.cta:focus-visible{outline:3px solid #1b1a18;outline-offset:2px}',
  '.alt{display:block;width:100%;background:#fff;border:2px solid #1f4e79;border-radius:9px;font-size:16px;font-weight:650;color:#1f4e79;padding:13px 16px;margin-top:12px;cursor:pointer;min-height:48px}',
  '.alt:focus-visible{outline:3px solid #1b1a18;outline-offset:2px}',
  '.rep{display:block;margin:14px auto 0;background:none;border:0;padding:12px 8px;min-height:44px;font-size:14px;color:#1f4e79;text-decoration:underline;cursor:pointer}',
  '.rep:focus-visible{outline:3px solid #1b1a18;outline-offset:2px}',
  '.disc{margin-top:12px;border-top:1px solid #e2ddd4}',
  '.dt{display:flex;width:100%;justify-content:space-between;align-items:center;background:none;border:0;padding:12px 2px;min-height:44px;font-size:14px;font-weight:600;color:#1f4e79;cursor:pointer;text-align:left}',
  '.dt:focus-visible,.sa:focus-visible,.cp:focus-visible{outline:3px solid #1b1a18;outline-offset:2px}',
  '.dt[aria-expanded="true"] .chev{transform:rotate(180deg)}',
  '.dbody{padding:0 2px 8px}',
  '.bt{font-size:14px;line-height:1.5;margin:0 0 10px;color:#3d3934}',
  '.bh{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6d665e;margin:14px 0 6px}',
  '.bl{margin:0 0 10px;padding-left:18px;font-size:14px;line-height:1.5;color:#3d3934}',
  '.bf{margin:0 0 10px;font-size:13px}.bf>div{padding:7px 0;border-bottom:1px solid #eee9df}.bf dt{margin:0}.bf dd{margin:2px 0 0;color:#3d3934;overflow-wrap:anywhere}.bf small{display:block;color:#6d665e;font-size:12px;margin-top:2px}',
  '.bf code{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;color:#1f4e79}',
  '.ph{list-style:none;margin:0 0 10px;padding:0}.ph li{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:9px 10px;margin-bottom:6px;border:1px solid #d9d2c5;border-radius:9px;font-size:14px;color:#3d3934}',
  '.cp,.sa{background:none;border:1px solid #1f4e79;color:#1f4e79;border-radius:7px;font-size:13px;font-weight:600;padding:8px 10px;min-height:44px;cursor:pointer;white-space:nowrap}',
  '.sa.danger{background:#b4573f;border-color:#b4573f;color:#fff}',
  '.ar{display:flex;gap:10px;align-items:center;margin:6px 0 10px;flex-wrap:wrap}.astat{font-size:12px;color:#6d665e}',
  '.co{display:flex;flex-direction:column;gap:8px;margin:6px 0 8px}',
  '.cb{display:block;width:100%;text-align:left;background:#fff;border:2px solid #d2cbc0;color:#1b1a18;border-radius:9px;font-size:15px;padding:12px 14px;min-height:48px;cursor:pointer}',
  '.cb[aria-pressed="true"]{border-color:#1f4e79;background:#eef4fa;font-weight:650}',
  '.cb:focus-visible{outline:3px solid #1b1a18;outline-offset:2px}',
  '.tm{margin:6px 0 10px}.tpg{display:block;width:100%;height:10px;margin:10px 0 6px}',
  '.tp:focus{outline:none}',
  '.tl{font-size:13px;color:#6d665e;min-height:18px}.tp{font-size:15px;font-weight:650;color:#1b1a18;min-height:22px}.td{font-size:14px;color:#3d3934}',
  '.conf{font-size:12px;color:#6d665e;margin-top:14px;border-top:1px solid #e2ddd4;padding-top:11px}',
  '.quiet{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);background:#26241f;color:#f5f1e8;font-size:13px;padding:11px 16px;border-radius:999px;z-index:2147483000;max-width:92vw}',
  '@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}',
].join('\n');
