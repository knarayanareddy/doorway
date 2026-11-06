/**
 * The Route — pure, deterministic, language-first lookup.
 * Language first, NOT country: a Dutch forum has English-speaking members and
 * telling them to call a Dutch-language line is worse than telling them nothing.
 */

export function baseLang(tag) {
  if (typeof tag !== 'string' || !tag) return 'en';
  return tag.toLowerCase().split(/[-_]/)[0] || 'en';
}

/**
 * @param {string} langTag e.g. navigator.language
 * @param {object} table  routes bundle
 * @param {{need?: 'any'|'human'|'selfhelp'}} opts
 */
export function resolve(langTag, table, opts = {}) {
  const need = opts.need || 'any';
  const lang = baseLang(langTag);
  const byLang = table?.byLanguage || {};

  const chain = [byLang[lang], byLang.en, byLang.generic].filter(Boolean);
  if (!chain.length) return { route: null, reason: 'no routes table', lang };

  for (const entry of chain) {
    const candidates = [entry.default, ...(entry.alternatives || [])].filter(Boolean);
    const hit = candidates.find((c) => satisfies(c, need));
    if (hit) {
      return {
        route: hit,
        lang: byLang[lang] ? lang : 'en',
        reason: byLang[lang] ? 'direct language match' : 'fallback to en',
      };
    }
  }

  // Nothing satisfies a human requirement: fall back to self-help rather than
  // sending someone to a phone that will not answer.
  const any = chain[0].default;
  return { route: any, lang, reason: 'human unavailable — self-help offered instead' };
}

function satisfies(route, need) {
  if (need === 'any') return true;
  if (need === 'human') return route.channel === 'chat' || route.channel === 'phone';
  if (need === 'selfhelp') return route.channel === 'selfhelp';
  return true;
}

/** Routes must never claim confidentiality without a cited source. */
export function assertHonest(routes) {
  const problems = [];
  const walk = (r, where) => {
    if (!r) return;
    if (r.channel !== 'selfhelp' && !r.conf) problems.push(`${where}: human route with no confidentiality statement`);
    if (r.conf && /verify|todo|unknown/i.test(r.conf)) problems.push(`${where}: confidentiality unverified — do not render`);
  };
  for (const [lang, entry] of Object.entries(routes.byLanguage || {})) {
    walk(entry.default, `${lang}/default`);
    (entry.alternatives || []).forEach((r, i) => walk(r, `${lang}/alt${i}`));
  }
  return problems;
}
