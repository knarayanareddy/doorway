/**
 * Kletskoek Forum — platform trigger logic
 *
 * This script is the platform side of the plug-in contract.
 * It loads fake-triggers.json, listens for search and chat input,
 * and fires 'sbis:trigger' CustomEvents on document.body when
 * a test-trigger-* term is matched.
 *
 * Your intervention module listens for 'sbis:trigger' events and
 * fires 'sbis:result' events back. See contract/PLUGIN_CONTRACT.md.
 */

let triggers = [];

// Load fake triggers
async function loadTriggers() {
  try {
    const resp = await fetch('/mock-platform/fake-triggers.json');
    triggers = await resp.json();
  } catch (e) {
    console.warn('[platform] Could not load fake-triggers.json:', e);
  }
}

/**
 * Check if input text matches any trigger term.
 * Returns the matching trigger entry or null.
 */
function matchTrigger(text) {
  const lower = text.trim().toLowerCase();
  return triggers.find(t => lower === t.term.toLowerCase()) || null;
}

/**
 * Fire a trigger event on document.body per the plug-in contract.
 */
function fireTrigger(trigger, source) {
  const lang = (navigator.language || 'en').split('-')[0];

  const event = new CustomEvent('sbis:trigger', {
    detail: {
      type: source,
      severity: trigger.severity,
      country: 'NL',
      language: lang,
      platformType: 'forum',
      timestamp: new Date().toISOString(),
      sessionScopedId: crypto.randomUUID(),
    },
  });

  console.log('[platform] Trigger fired:', event.detail);
  document.body.dispatchEvent(event);
}

// Listen for results from the module
document.body.addEventListener('sbis:result', (e) => {
  console.log('[platform] Module result:', e.detail);
});

// --- Search form ---
const searchForm = document.getElementById('search-form');
if (searchForm) {
  searchForm.addEventListener('submit', (e) => {
    const input = document.getElementById('search-input');
    const match = matchTrigger(input?.value || '');
    if (match) {
      e.preventDefault();
      fireTrigger(match, 'search');
    }
    // If no match, the form submits normally to search.html
  });
}

// Also check on search.html page load (when arriving via URL query)
if (window.location.pathname.includes('search.html')) {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  loadTriggers().then(() => {
    const match = matchTrigger(q);
    if (match) {
      fireTrigger(match, 'search');
    }
  });
}

// --- Chat panel ---
const chatSend = document.getElementById('chat-send');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

if (chatSend && chatInput) {
  function handleChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Add message to chat
    if (chatMessages) {
      const msg = document.createElement('div');
      msg.className = 'chat-message';
      msg.innerHTML = `<span class="author">Jij:</span> ${escapeHtml(text)}`;
      chatMessages.appendChild(msg);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Check for trigger match
    const match = matchTrigger(text);
    if (match) {
      fireTrigger(match, 'chat');
    }

    chatInput.value = '';
  }

  chatSend.addEventListener('click', handleChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleChat();
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load triggers on startup
loadTriggers();
