/**
 * Pure builders for the card's content sections: the Glass Door and the Hallway.
 * Everything is plain data for shared/card.js, which escapes it on render.
 *
 * What a service says about itself (privacy, hours) appears here ONLY through the same
 * predicates that guard every other claim: isRenderableConfidence and isRenderableHours.
 */
import { FIELDS } from '../../core/src/counter.js';
import { isRenderableConfidence } from '../../core/src/route.js';
import { isRenderableHours, openStatus } from '../../core/src/hours.js';
import { GLASS, HALLWAY_PHRASES, HALLWAY_FAQ, langOf } from './copy.js';

/**
 * The Glass Door. `preview` is the exact object the Door would send for this exposure, with
 * `o` (the outcome) still null: it does not exist until the person acts.
 *
 * @param {{lang:string, preview:Record<string,string|null>, localCount:number, onWipe:()=>void}} a
 */
export function glassSection({ lang, preview, localCount, onWipe }) {
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
      const blocks = [{ type: 'text', text: st.open ? HALLWAY_FAQ.openUntil[L](st.closesAt) : HALLWAY_FAQ.closedOpens[L](st.opensAt) }];
      if (!st.open && selfhelp && selfhelp.id !== route.id) blocks.push({ type: 'text', text: HALLWAY_FAQ.closedTip[L] });
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
          { type: 'action', id: 'alt', label: HALLWAY_FAQ.altLabel[L], closes: true, onSelect: onAlt },
        ],
      },
    });
  }
  return sections;
}
