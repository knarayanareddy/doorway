/**
 * Pure builders for the card's content sections: the Glass Door and the Hallway.
 * Everything is plain data for shared/card.js, which escapes it on render.
 *
 * What a service says about itself (privacy, hours) appears here ONLY through the same
 * predicates that guard every other claim: isRenderableConfidence and isRenderableHours.
 */
import { FIELDS } from '../../core/src/counter.js';
import { isRenderableConfidence, isAllowedDestination } from '../../core/src/route.js';
import { isRenderableHours, openStatus } from '../../core/src/hours.js';
import { GLASS, HALLWAY_PHRASES, HALLWAY_FAQ, DOOR, DEMO_TAG, LABELS, langOf } from './copy.js';

/**
 * The Glass Door. `preview` is the exact object the Door would send for this exposure, with
 * `o` (the outcome) still null: it does not exist until the person acts.
 *
 * @param {{lang:string, preview:Record<string,string|null>, localCount:number, onWipe:()=>void}} a
 */
export function glassSection({ lang, preview, localCount, onWipe, extraLocal = null }) {
  const L = langOf(lang);
  const rows = FIELDS.map((k) => ({
    k,
    v: preview[k] == null ? GLASS.pending[L] : `"${preview[k]}"`,
    note: GLASS.fields[k][L],
  }));
  return {
    placement: 'footer',
    disclosure: {
      label: GLASS.label[L],
      blocks: [
        { type: 'text', text: GLASS.lead[L] },
        { type: 'heading', text: GLASS.leavesHeading[L] },
        { type: 'fields', rows },
        { type: 'heading', text: GLASS.neverHeading[L] },
        { type: 'list', items: GLASS.never[L] },
        { type: 'text', text: GLASS.honest[L] },
        { type: 'heading', text: GLASS.localHeading[L] },
        { type: 'text', text: GLASS.local[L](localCount) },
        ...(extraLocal ? [{ type: 'text', text: extraLocal }] : []),
        { type: 'action', id: 'wipe', label: GLASS.wipe[L], closes: false, onSelect: () => { onWipe(); return { message: GLASS.wiped[L] }; } },
        { type: 'heading', text: GLASS.verifyHeading[L] },
        { type: 'text', text: GLASS.verify[L] },
      ],
    },
  };
}

/**
 * The Hallway.
 * @param {{lang:string, route:object|null, selfhelp:object|null, now?:number, onAlt:()=>void}} a
 */
export function hallwaySections({ lang, route, selfhelp, now = Date.now(), onAlt }) {
  const L = langOf(lang);
  const sections = [];

  // Opening hours: only for a route verified within the year, and never "closed" when unknown.
  if (route && isRenderableHours(route, now)) {
    const st = openStatus(route.hours, new Date(now));
    if (st) {
      const openDay = !st.tomorrow && st.opensDay ? st.opensDay : null;
      const blocks = [{ type: 'text', text: st.open ? HALLWAY_FAQ.openUntil[L](st.closesAt) : HALLWAY_FAQ.closedOpens[L](st.opensAt, openDay) }];
      if (!st.open && selfhelp && selfhelp.id !== route.id) blocks.push({ type: 'text', text: HALLWAY_FAQ.closedTip[L] });
      if (route.demo === true) blocks.unshift({ type: 'text', text: DEMO_TAG[L] });
      sections.push({ blocks });
    }
  }

  sections.push({
    blocks: [
      { type: 'heading', text: HALLWAY_PHRASES.heading[L] },
      { type: 'phrases', items: HALLWAY_PHRASES.items[L], copyLabel: HALLWAY_PHRASES.copy[L], copiedLabel: HALLWAY_PHRASES.copied[L] },
    ],
  });

  if (route && isRenderableConfidence(route, now)) {
    sections.push({
      disclosure: {
        label: HALLWAY_FAQ.privacyQ[L],
        blocks: [
          { type: 'text', text: route.conf.text },
          { type: 'text', text: HALLWAY_FAQ.privacyBy[L](route.conf.verifiedBy, String(route.conf.verifiedAt).slice(0, 10)) },
        ],
      },
    });
  }

  if (route && selfhelp && selfhelp.id !== route.id && selfhelp.url) {
    sections.push({
      disclosure: {
        label: HALLWAY_FAQ.nocallQ[L],
        blocks: [
          { type: 'text', text: HALLWAY_FAQ.nocallA[L] },
          { type: 'action', id: 'alt', label: HALLWAY_FAQ.altLabel[L], closes: true, outcome: 'clicked_help', routeId: selfhelp.id, onSelect: onAlt },
        ],
      },
    });
  }
  return sections;
}

/** A route's url, only if it is on the allow-list (the bundle already drops others; this is the same rule, again). */
const allowed = (r) => (r && typeof r.url === 'string' && isAllowedDestination(r.url) ? r : null);
/** A dialable number: digits and an optional leading +, 6 to 20 of them. Otherwise null, and no call is offered. */
const telFor = (phone) => {
  const digits = typeof phone === 'string' ? phone.replace(/[\s()-]/g, '') : '';
  return /^\+?\d{6,20}$/.test(digits) ? digits : null;
};

/**
 * The Door (exposure 5+): presence, not pressure. What it says about the line depends only on verified data:
 *   - "open" with a call button  only if isRenderableHours passes, the hours say open, and the route has a number;
 *   - "opens at ..." to self-help only if isRenderableHours passes and the hours say closed;
 *   - otherwise neither open nor closed is claimed, and the one action is a plain link to the help service.
 * Links are only ever followed through `onOpen`, which the widget gives the card; tel: is a href and never a URL.
 * `tag` is 'Demo data' only when the hours or the number come from the DEMO record (route.demo === true).
 *
 * @param {{lang:string, route:object|null, selfhelp:object|null, now?:number, n?:number, onOpen:(url:string)=>void}} a
 *   n: the exposure count; the headline rotates with it (titles[(n-5) % length]), as the reference Door does.
 */
export function doorPanel({ lang, route, selfhelp = null, now = Date.now(), n = 1, onOpen }) {
  const L = langOf(lang);
  const t = DOOR[L];
  const base = { kicker: t.kicker, headline: t.titles[Math.max(0, n - 5) % t.titles.length], body: t.body, tag: null, chat: null };
  const help = allowed(route);
  if (!help) return { ...base, primary: { label: LABELS.close[L], kind: 'primary' } };

  const hours = isRenderableHours(route, now) ? openStatus(route.hours, new Date(now)) : null;
  const demo = route.demo === true ? DEMO_TAG[L] : null;
  const tel = telFor(route.phone);
  if (hours && hours.open && tel) {
    return {
      ...base,
      tag: demo,
      primary: { label: `${t.callOpen} ${route.phone.trim()}`, kind: 'primary', outcome: 'clicked_help', routeId: help.id, href: `tel:${tel}` },
      chat: { type: 'action', id: 'chat', label: t.chat, closes: true, outcome: 'clicked_help', routeId: help.id, onSelect: () => onOpen(help.url) },
    };
  }
  if (hours && !hours.open) {
    const self = allowed(selfhelp);
    const target = self || help;
    return {
      ...base,
      tag: demo,
      primary: {
        label: self && hours.opensAt ? t.closed(hours.opensAt + (hours.opensDay && !hours.tomorrow ? ` ${hours.opensDay}` : '')) : LABELS.primary[L],
        kind: 'primary', outcome: 'clicked_help', routeId: target.id, onSelect: () => onOpen(target.url),
      },
    };
  }
  return { ...base, primary: { label: LABELS.primary[L], kind: 'primary', outcome: 'clicked_help', routeId: help.id, onSelect: () => onOpen(help.url) } };
}
