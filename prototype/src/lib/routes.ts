/**
 * Routes come from the real signed bundle (packages/doorway/src/routes.nl.json), resolved by the same
 * resolve() the Door uses and filtered by dropDisallowed(), so every link the app can open is on the
 * destination allow-list. Nothing here is hand-written.
 */
import bundle from "@repo/packages/doorway/src/routes.nl.json";
import { dropDisallowed } from "@repo/packages/core/src/route.js";
import { LEGAL_RECORDS } from "@repo/packages/doorway/src/legal-records.js";
import type { Lang } from "./content";
import { resolveRoute } from "./core";
import { syntheticConfidence, syntheticHoursVerifiedAt, syntheticLegalRecord } from "./synthetic";

export interface Route {
  id: string;
  name: string;
  channel: string;
  url: string;
  phone?: string;
  hours?: string;
  verifiedAt?: string | null;
  conf?: { text: string; basis: string; sourceUrl: string | null; verifiedBy: string | null; verifiedAt: string | null; expiresAt: string | null };
}

/** The forum in the demo is Dutch, and its platform declares the jurisdiction explicitly. */
export const COUNTRY = "NL";
export const LEGAL_JURISDICTION = "NL";

const allowed = dropDisallowed(bundle) as typeof bundle;

/** With the preview ON, the NL line gets a synthetic verified hours date and confidentiality record. */
function table(synthetic: boolean, now: number) {
  if (!synthetic) return allowed;
  const nl = allowed.byLanguage.nl;
  return {
    ...allowed,
    byLanguage: {
      ...allowed.byLanguage,
      nl: { ...nl, default: { ...nl.default, verifiedAt: syntheticHoursVerifiedAt(now), conf: syntheticConfidence(now) } },
    },
  };
}

export function routesFor(lang: Lang, synthetic = false, now = Date.now()) {
  const t = table(synthetic, now);
  const primary = resolveRoute(lang, t, { need: "human", country: COUNTRY }).route as Route | null;
  const selfhelp = resolveRoute(lang, t, { need: "selfhelp", country: COUNTRY }).route as Route | null;
  return { primary, selfhelp };
}

/** Reviewed legal records. The real NL record is a draft (reviewedBy null), so it never renders. */
export const legalRecordsFor = (synthetic: boolean, now = Date.now()) => (synthetic ? [...LEGAL_RECORDS, syntheticLegalRecord(now)] : LEGAL_RECORDS);

/** Every route id the app can put in field `r`. */
export const routeId = (r: Route | null) => r?.id ?? "xx-none";
