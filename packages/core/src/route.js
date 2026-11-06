/**
 * The Route — pure, deterministic lookup, language first, country as a filter.
 *
 * Why language first: a Dutch forum has English-speaking members, and telling
 * them to call a Dutch-language line is worse than telling them nothing.
 *
 * Why country is still needed: PLUGIN_CONTRACT.md makes `country` a REQUIRED
 * field of every trigger event (ISO 3166-1 alpha-2). We ignored it, and the
 * result was measurable on 6 Nov — a German-speaking user was routed to a UK
 * number because `de` had no entry and the chain fell through to `en`. Country
 * is used only to FILTER: it can remove a service that does not serve you, it
 * can never override your language, and an unknown country degrades to the
 * language-only behaviour we had before rather than to nothing.
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
  const country = normaliseCountry(opts.country);
  const lang = baseLang(langTag);
  const byLang = table?.byLanguage || {};

  // A country-specific table wins outright when it exists, but it is still
  // filtered by language inside, so a German speaker in the Netherlands gets the
  // Dutch line only if that line actually speaks German.
  const byCountry = country ? (table?.byCountry || {})[country] : null;
  const chain = [
    byCountry?.[lang],
    byLang[lang],
    byCountry?.en,
    byLang.en,
    byLang.generic,
  ].filter(Boolean);

  if (!chain.length) return { route: null, reason: 'no routes table', lang, country };

  for (const entry of chain) {
    const candidates = [entry.default, ...(entry.alternatives || [])].filter(Boolean);
    const eligible = candidates.filter((c) => satisfies(c, need) && servesCountry(c, country));
    if (eligible.length) {
      // Specificity beats position. A service that explicitly lists your country
      // outranks one with no `countries` field at all — otherwise a global
      // self-help page listed as `default` hides a national helpline listed as
      // an alternative. That is exactly what happened to UK users on 6 Nov.
      const hit = eligible.find((c) => listsCountry(c, country)) || eligible[0];
      return {
        route: hit,
        lang: byLang[lang] ? lang : 'en',
        country,
        reason: listsCountry(hit, country)
          ? `direct match (${country})`
          : (byLang[lang] ? 'direct language match' : 'fallback to en'),
      };
    }
  }

  // Nothing in the chain satisfies the requirement under this country.
  //
  // Order of degradation, and every step of it must be honest about what it did:
  //   1. a self-help route in your language — never requires a phone call
  //   2. a human route in your language that does not claim to serve you, used
  //      only when there is no self-help option at all — and SAY that
  //   3. nothing: better to render no route than a wrong number
  const all = chain.flatMap((e) => [e.default, ...(e.alternatives || [])]).filter(Boolean);

  // A human route that genuinely serves this country is never skipped over in
  // favour of self-help. This is the FI/en case: ReDirection is self-help and
  // cross-border, so before this line existed a Finnish user asking for a human
  // line got the self-help page instead of ReDirection's own line.
  const inCountry = all.find((c) => satisfies(c, need) && servesCountry(c, country));
  if (inCountry) {
    return { route: inCountry, lang, country, reason: 'serves this country' };
  }

  const selfHelp = all.find((c) => c.channel === 'selfhelp' || c.channel === 'chat');
  if (selfHelp) {
    return { route: selfHelp, lang, country, reason: 'no local human service — self-help offered instead' };
  }

  const misfit = all.find((c) => satisfies(c, need));
  if (misfit) {
    return {
      route: misfit,
      lang,
      country,
      reason: `no service confirmed for ${country || 'this country'} — offering ${misfit.id}, which serves ${(misfit.countries || []).join('/') || 'unspecified'}`,
      outOfCountry: true,
    };
  }

  return { route: null, lang, country, reason: 'no service available for this language and country' };
}

/** ISO 3166-1 alpha-2, or null when absent/implausible. Never throws. */
export function normaliseCountry(c) {
  if (typeof c !== 'string' || c.length !== 2) return null;
  return c.toUpperCase();
}

/**
 * Does this service serve that country?
 *
 * `countries: ['NL']` restricts. No `countries` field means "serves everyone" —
 * which is true of ReDirection (six languages, cross-border) and false of a
 * national helpline, so the field is what separates them.
 */
export function servesCountry(route, country) {
  if (!country) return true;
  const list = route?.countries;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.map((x) => String(x).toUpperCase()).includes(country);
}

/** True only when the service explicitly names this country. Used for ranking. */
export function listsCountry(route, country) {
  if (!country) return false;
  const list = route?.countries;
  if (!Array.isArray(list) || list.length === 0) return false;
  return list.map((x) => String(x).toUpperCase()).includes(country);
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
