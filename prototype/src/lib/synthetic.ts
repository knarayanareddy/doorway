/**
 * "Reviewed-claims preview (SYNTHETIC)": invented records, injected only when the viewer turns the
 * preview on, so they can SEE what a verified claim looks like. They go through the same predicates
 * as real data (isRenderableConfidence, isRenderableHours, legalRecordFor); they are not from
 * Offlimits and not legal advice.
 */
const DAY = 24 * 3.6e6;
const iso = (t: number) => new Date(t).toISOString();

export const SYNTHETIC_REVIEWER = "Demo Reviewer (synthetic)";

export const SYNTHETIC_NOTE = {
  nl: "Synthetische voorbeeldclaims — niet van Offlimits, geen juridisch advies.",
  en: "Synthetic example claims — not from Offlimits, not legal advice.",
} as const;

export function syntheticConfidence(now: number) {
  return {
    text: "[SYNTHETIC — not from Offlimits] Example of a service's own privacy wording, shown only to illustrate how a verified record looks.",
    basis: "synthetic-demo",
    sourceUrl: "https://example.org/synthetic-demo",
    verifiedBy: SYNTHETIC_REVIEWER,
    verifiedAt: iso(now - 2 * DAY),
    expiresAt: iso(now + 180 * DAY),
  };
}

export const syntheticHoursVerifiedAt = (now: number) => iso(now - 2 * DAY);

export function syntheticLegalRecord(now: number) {
  const h = { nl: "[SYNTHETIC] Voorbeeld van een beoordeelde juridische mededeling", en: "[SYNTHETIC] Example of a reviewed legal statement" };
  const b = {
    nl: "Synthetische tekst, alleen om te laten zien hoe een door een jurist beoordeeld record eruitziet. Geen echte wet, geen juridisch advies.",
    en: "Synthetic text, only to show what a record reviewed by counsel looks like. Not a real law, not legal advice.",
  };
  const variants = (l: "nl" | "en") => [0, 1, 2].map(() => ({ h: h[l], b: b[l] }));
  return {
    jurisdiction: "NL",
    claimId: "synthetic-demo",
    sourceCitation: "SYNTHETIC demo record — not a legal source",
    reviewedBy: SYNTHETIC_REVIEWER,
    reviewedAt: iso(now - 2 * DAY),
    expiresAt: iso(now + 180 * DAY),
    copy: { nl: variants("nl"), en: variants("en") },
  };
}
