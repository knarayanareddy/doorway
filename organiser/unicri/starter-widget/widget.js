/**
 * Starter widget — Stop Before It Starts
 *
 * A deliberately plain, working reference module. Teams are expected to
 * improve the format, copy and flow. This is the baseline to beat.
 *
 * The widget:
 * - Listens for 'sbis:trigger' events from the platform
 * - Shows an interstitial warning with the Dutch legal message (article 252)
 * - Routes to the Offlimits prevention line with one click
 * - Supports Dutch and English based on navigator.language
 * - Uses ARIA dialog pattern with focus trapping
 * - Reports 'sbis:result' events back to the platform
 *
 * Usage:
 *   <script type="module" src="starter-widget/widget.js"></script>
 *   or
 *   import './starter-widget/widget.js';
 */

// --- Load data ---
let helpServices = [];
let messageBlocks = [];

async function loadData() {
  try {
    // Resolve data/ relative to the widget's own location (works both in
    // the mock platform served by Vite and when loaded standalone).
    const base = new URL('.', import.meta.url);
    const dataDir = new URL('../data/', base);

    const [servicesResp, blocksResp] = await Promise.all([
      fetch(new URL('help-services.json', dataDir)),
      fetch(new URL('message-blocks.json', dataDir)),
    ]);

    helpServices = await servicesResp.json();
    messageBlocks = await blocksResp.json();
  } catch (e) {
    console.warn('[widget] Could not load data files:', e);
  }
}

// --- Language detection ---
function getLanguage() {
  const lang = (navigator.language || 'en').split('-')[0].toLowerCase();
  return lang === 'nl' ? 'nl' : 'en';
}

// --- Get messages for current language ---
function getMessages(lang) {
  const legal = messageBlocks.find(b => b.category === 'legal' && b.lang === lang)
    || messageBlocks.find(b => b.category === 'legal' && b.lang === 'en');
  const harm = messageBlocks.find(b => b.category === 'harm' && b.lang === lang)
    || messageBlocks.find(b => b.category === 'harm' && b.lang === 'en');
  const help = messageBlocks.find(b => b.category === 'help' && b.lang === lang)
    || messageBlocks.find(b => b.category === 'help' && b.lang === 'en');
  const selfEfficacy = messageBlocks.find(b => b.category === 'self_efficacy' && b.lang === lang)
    || messageBlocks.find(b => b.category === 'self_efficacy' && b.lang === 'en');
  const confidentiality = messageBlocks.find(b => b.category === 'confidentiality' && b.lang === lang)
    || messageBlocks.find(b => b.category === 'confidentiality' && b.lang === 'en');

  return { legal, harm, help, selfEfficacy, confidentiality };
}

// --- Get primary help service for country ---
function getPrimaryService(country) {
  return helpServices.find(s => s.country === country) || helpServices[0];
}

// --- UI labels ---
const labels = {
  nl: {
    title: 'Waarschuwing',
    helpTitle: 'Hulp is beschikbaar',
    helpButton: 'Neem contact op',
    phoneLabel: 'Of bel gratis:',
    dismiss: 'Sluiten',
    srClose: 'Waarschuwing sluiten',
  },
  en: {
    title: 'Warning',
    helpTitle: 'Help is available',
    helpButton: 'Get help now',
    phoneLabel: 'Or call free:',
    dismiss: 'Close',
    srClose: 'Close warning',
  },
};

// --- Build the widget DOM ---
function createWidget(trigger) {
  const lang = getLanguage();
  const l = labels[lang];
  const msgs = getMessages(lang);
  const service = getPrimaryService(trigger.country || 'NL');
  const showTime = Date.now();

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'sbis-overlay';
  overlay.setAttribute('role', 'presentation');

  // Dialog
  const dialog = document.createElement('div');
  dialog.className = 'sbis-widget';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', l.title);
  dialog.setAttribute('tabindex', '-1');

  dialog.innerHTML = `
    <div class="sbis-widget__header">
      <span class="sbis-widget__icon" aria-hidden="true">⚠️</span>
      <h2 class="sbis-widget__title">${l.title}</h2>
    </div>

    ${msgs.legal ? `<p class="sbis-widget__message sbis-widget__message--legal">${escapeHtml(msgs.legal.text)}</p>` : ''}
    ${msgs.harm ? `<p class="sbis-widget__message">${escapeHtml(msgs.harm.text)}</p>` : ''}
    ${msgs.selfEfficacy ? `<p class="sbis-widget__message">${escapeHtml(msgs.selfEfficacy.text)}</p>` : ''}

    <div class="sbis-widget__help">
      <div class="sbis-widget__help-title">${l.helpTitle}</div>
      ${service ? `
        <div class="sbis-widget__help-service">
          <strong>${escapeHtml(service.name)}</strong>
          ${service.confidentiality_note ? `<br><small>${escapeHtml(service.confidentiality_note)}</small>` : ''}
        </div>
        <a
          class="sbis-widget__help-link"
          href="${escapeAttr(service.url)}"
          target="_blank"
          rel="noopener noreferrer"
          data-service-id="${escapeAttr(service.id)}"
        >${l.helpButton}</a>
        ${service.phone ? `<div class="sbis-widget__phone">${l.phoneLabel} <strong>${escapeHtml(service.phone)}</strong></div>` : ''}
      ` : ''}
    </div>

    ${msgs.confidentiality ? `<p class="sbis-widget__message"><small>${escapeHtml(msgs.confidentiality.text)}</small></p>` : ''}

    <div class="sbis-widget__actions">
      <button class="sbis-widget__dismiss" type="button">${l.dismiss}</button>
    </div>
  `;

  overlay.appendChild(dialog);

  // --- Event handlers ---
  function reportResult(outcome, serviceId = null) {
    const result = {
      shown: true,
      variantId: 'starter-v1',
      outcome,
      helpServiceId: serviceId,
      durationMs: Date.now() - showTime,
      timestamp: new Date().toISOString(),
    };

    document.body.dispatchEvent(new CustomEvent('sbis:result', { detail: result }));
    close();
  }

  function close() {
    overlay.remove();
    // Restore focus to body
    document.body.focus();
  }

  // Dismiss button
  const dismissBtn = dialog.querySelector('.sbis-widget__dismiss');
  dismissBtn.addEventListener('click', () => reportResult('dismissed'));

  // Help link
  const helpLink = dialog.querySelector('.sbis-widget__help-link');
  if (helpLink) {
    helpLink.addEventListener('click', () => {
      reportResult('clicked_help', helpLink.dataset.serviceId);
    });
  }

  // Escape key
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      reportResult('dismissed');
    }

    // Focus trap
    if (e.key === 'Tab') {
      const focusable = dialog.querySelectorAll('a[href], button, [tabindex]');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Click outside to dismiss
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      reportResult('dismissed');
    }
  });

  return overlay;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --- Show the widget ---
function showWidget(trigger) {
  const widget = createWidget(trigger);
  document.body.appendChild(widget);

  // Focus the dialog
  const dialog = widget.querySelector('.sbis-widget');
  dialog.focus();
}

// --- Listen for trigger events ---
document.body.addEventListener('sbis:trigger', (e) => {
  const trigger = e.detail;
  console.log('[widget] Trigger received:', trigger);

  // Only show for medium and high severity
  if (trigger.severity === 'high' || trigger.severity === 'medium') {
    showWidget(trigger);
  } else {
    // For low severity, just log (teams can build subtle indicators)
    console.log('[widget] Low severity — no interstitial shown');
    document.body.dispatchEvent(new CustomEvent('sbis:result', {
      detail: {
        shown: false,
        variantId: 'starter-v1',
        outcome: 'continued',
        helpServiceId: null,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      },
    }));
  }
});

// --- Init ---
loadData();
console.log('[widget] Starter widget loaded. Listening for sbis:trigger events.');
