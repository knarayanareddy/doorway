/**
 * Legal claims are structured, reviewed records — never free text in the widget
 * (review B8). A legal claim renders only when:
 *   1. the PLATFORM declared `legalJurisdiction` explicitly (it is never inferred
 *      from the visitor's locale or from routing country), and
 *   2. a record exists for that jurisdiction with a named reviewer, a review date
 *      inside the last twelve months, and an expiry that has not passed.
 * Anything else falls back to the neutral harm copy.
 */

const MONTH_MS = 30.4375 * 24 * 3.6e6;
export const LEGAL_MAX_AGE_MONTHS = 12;

export function isRenderableLegal(rec, now = Date.now()) {
  if (!rec || typeof rec !== 'object') return false;
  const named = (v) => typeof v === 'string' && v.trim().length > 1;
  if (!named(rec.jurisdiction) || !named(rec.sourceCitation) || !named(rec.reviewedBy)) return false;
  const reviewed = Date.parse(rec.reviewedAt);
  const expires = Date.parse(rec.expiresAt);
  if (!Number.isFinite(reviewed) || !Number.isFinite(expires)) return false;
  if (reviewed > now || now - reviewed > LEGAL_MAX_AGE_MONTHS * MONTH_MS) return false;
  return expires > now;
}

/** The reviewed record for an explicitly declared jurisdiction, or null. */
export function legalRecordFor(jurisdiction, records, now = Date.now()) {
  if (typeof jurisdiction !== 'string' || jurisdiction.length !== 2) return null;
  const j = jurisdiction.toUpperCase();
  return (records || []).find((r) => r.jurisdiction === j && isRenderableLegal(r, now)) || null;
}
