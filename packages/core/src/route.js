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
  if (need === 'human') return isHuman(route);
  if (need === 'selfhelp') return route.channel === 'selfhelp';
  return true;
}

/** A person answers, whether by chat, phone or an intake appointment. */
export function isHuman(route) {
  return route?.channel === 'chat' || route?.channel === 'phone' || route?.channel === 'programme';
}

const MONTH_MS = 30.4375 * 24 * 3.6e6;
export const CONFIDENCE_MAX_AGE_MONTHS = 12;

/**
 * THE confidentiality predicate. The widget, assertHonest() and CI all call this
 * and nothing else — there is no second regex that happens to catch what this
 * one misses (review B3).
 *
 * A claim is renderable only if it is a structured record naming its basis, its
 * source, a named person at the service who confirmed it, a confirmation date
 * inside the last twelve months, and an expiry that has not passed.
 */
export function isRenderableConfidence(route, now = Date.now()) {
  const c = route?.conf;
  if (!c || typeof c !== 'object') return false;
  const named = (v) => typeof v === 'string' && v.trim().length > 1;
  if (!named(c.text) || !named(c.basis) || !named(c.verifiedBy)) return false;
  if (!/^https:\/\//.test(c.sourceUrl || '')) return false;
  const verified = Date.parse(c.verifiedAt);
  const expires = Date.parse(c.expiresAt);
  if (!Number.isFinite(verified) || !Number.isFinite(expires)) return false;
  if (verified > now) return false;
  if (now - verified > CONFIDENCE_MAX_AGE_MONTHS * MONTH_MS) return false;
  return expires > now;
}

/**
 * Where a primary button may send a person in crisis. Exact hostnames, https
 * only, no wildcards. A route outside this list is dropped even if the bundle's
 * signature is valid (review B4).
 */
export const DESTINATION_ALLOWLIST = Object.freeze([
  'offlimits.nl',
  'stoppenismogelijk.eu',
  'www.suojellaanlapsia.fi',
  'www.stopitnow.org.uk',
  'www.stopitnow.org',
  'www.stopitnow.org.au',
  'www.preventell.se',
  'www.kein-taeter-werden.de',
]);

export function isAllowedDestination(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && DESTINATION_ALLOWLIST.includes(u.hostname);
  } catch {
    return false;
  }
}

/**
 * A youth service, for the under-18 path. It is offered ONLY when a route in the bundle is marked
 * `audience: "youth"` AND carries a complete written agreement from the service (named contact,
 * reference, date), an allow-listed destination, and a review date that has not passed. The shipped
 * bundle has none, so today that path offers supportive copy and no link (docs/11 D5).
 */
export function youthRoute(bundle, lang, now = Date.now()) {
  const entry = bundle?.byLanguage?.[lang];
  if (!entry) return null;
  for (const r of [entry.default, ...(entry.alternatives || [])]) {
    if (!r || r.audience !== 'youth') continue;
    const a = r.agreement;
    const named = (v) => typeof v === 'string' && v.trim().length > 1;
    if (!a || !named(a.contact) || !named(a.okRef) || !Number.isFinite(Date.parse(a.okAt))) continue;
    if (!isAllowedDestination(r.url)) continue;
    const review = Date.parse(r.reviewBy);
    if (!Number.isFinite(review) || review < now) continue;
    return r;
  }
  return null;
}

/** Every route in a bundle, with where it sits. */
export function allRoutes(bundle) {
  const out = [];
  for (const [lang, entry] of Object.entries(bundle?.byLanguage || {})) {
    if (entry.default) out.push({ r: entry.default, where: `${lang}/default` });
    (entry.alternatives || []).forEach((r, i) => out.push({ r, where: `${lang}/alt${i}` }));
  }
  return out;
}

/** The bundle with every route whose destination is not allow-listed removed. */
export function dropDisallowed(bundle) {
  const keep = (r) => r && isAllowedDestination(r.url);
  const byLanguage = {};
  for (const [lang, entry] of Object.entries(bundle?.byLanguage || {})) {
    const all = [entry.default, ...(entry.alternatives || [])].filter(keep);
    if (!all.length) continue;
    byLanguage[lang] = { default: all[0], alternatives: all.slice(1) };
  }
  return { ...bundle, byLanguage };
}

/**
 * Route data honesty. Returns a list of problems; empty means the table may ship.
 * A confidentiality record that is merely not-yet-verified is NOT a problem — it
 * is simply never rendered. Everything that could mislead a caller is.
 */
export function assertHonest(routes, now = Date.now()) {
  const problems = [];
  for (const { r, where } of allRoutes(routes)) {
    if (!isAllowedDestination(r.url)) problems.push(`${where}: destination ${r.url} is not on the allow-list`);
    if (typeof r.conf === 'string') problems.push(`${where}: conf must be a structured record, not free text`);
    if (r.conf && typeof r.conf === 'object') {
      for (const k of ['text', 'basis', 'sourceUrl', 'verifiedBy', 'verifiedAt', 'expiresAt']) {
        if (!(k in r.conf)) problems.push(`${where}: conf record missing ${k}`);
      }
    }
    if (r.channel === 'phone' && !r.phone) problems.push(`${where}: channel is phone but no phone number is given`);
    if (r.channel === 'programme' && r.phone) problems.push(`${where}: a programme with an intake is not a helpline — drop phone or change channel`);
    const review = Date.parse(r.reviewBy);
    if (!Number.isFinite(review)) problems.push(`${where}: no reviewBy date`);
    else if (review < now) problems.push(`${where}: reviewBy ${r.reviewBy} has passed — re-verify this route`);
  }
  return problems;
}
