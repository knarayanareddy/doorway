/**
 * The live Desk: reads the real Door's GET /v1/agg through the platform's same-origin
 * proxy (/__desk/agg), parses the answer, and computes the adoption ladder from it.
 *
 * Pure functions, no React and no DOM beyond the injected fetch, so they can be unit-tested.
 * Every number shown comes from the response. A cell the Door suppressed arrives as null
 * (or suppressed:true) and is shown as "hidden: fewer than k", never as 0 and never guessed.
 */

/** Default k-anonymity threshold; the Door sends its own as summary.k. */
export const K_DEFAULT = 10;

/**
 * A count as the Door sent it.
 *   number     shown
 *   null       suppressed by the Door (under k, or secondary suppression)
 *   undefined  this Door did not send the field (older edge)
 */
export type Cell = number | null | undefined;

export interface OutcomeCell { outcome: string; count: Cell; suppressed: boolean }
export interface ClickThrough { rate: Cell; clicked: Cell; shown: Cell; note: string | null }
export interface FlaggedDay { day: string; reasons: string[] }
export interface Summary {
  label: string | null;
  k: number;
  exposures: Cell;
  outcomes: OutcomeCell[] | null;
  clickThrough: ClickThrough | null;
  flaggedDays: FlaggedDay[] | null;
}
export interface DayRow { day: string; exposures: Cell; flagged: boolean }
export interface FormatRow { format: string; exposures: Cell; clicked: Cell; rate: Cell; suppressed: boolean }
export interface KeyRow { key: string; exposures: Cell; clicked: Cell; rate: Cell; suppressed: boolean }
export interface ReportRow { reason: string; count: Cell; suppressed: boolean }

export interface DeskAgg {
  label: string | null;
  periodDays: number | null;
  summary: Summary;
  /** null: this Door did not send the array. [] : it sent none. */
  days: DayRow[] | null;
  byFormat: FormatRow[] | null;
  byTrigger: KeyRow[] | null;
  byRoute: KeyRow[] | null;
  byEscalation: KeyRow[] | null;
  variantArms: KeyRow[] | null;
  droppedEvents: Cell;
  falsePositiveReports: ReportRow[] | null;
}

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const cell = (x: unknown): Cell => (x === null ? null : typeof x === "number" && Number.isFinite(x) ? x : undefined);
const str = (x: unknown): string | null => (typeof x === "string" ? x : null);
const bool = (x: unknown): boolean => x === true;
function list<T>(x: unknown, f: (o: Obj) => T): T[] | null {
  return Array.isArray(x) ? x.filter(isObj).map(f) : null;
}

/** Parse the /v1/agg answer. Returns null when the answer has no summary to show. */
export function parseAgg(raw: unknown): DeskAgg | null {
  if (!isObj(raw) || !isObj(raw.summary)) return null;
  const s = raw.summary;
  const k = typeof s.k === "number" && s.k > 0 ? s.k : K_DEFAULT;
  const ct = isObj(s.clickThrough) ? s.clickThrough : null;
  return {
    label: str(s.label) ?? str(raw.label),
    periodDays: typeof raw.periodDays === "number" ? raw.periodDays : null,
    summary: {
      label: str(s.label) ?? str(raw.label),
      k,
      exposures: cell(s.exposures),
      outcomes: list(s.outcomes, (o) => ({ outcome: str(o.outcome) ?? "unknown", count: cell(o.count), suppressed: bool(o.suppressed) })),
      clickThrough: ct ? { rate: cell(ct.rate), clicked: cell(ct.clicked), shown: cell(ct.shown), note: str(ct.note) } : null,
      flaggedDays: list(s.flaggedDays, (f) => ({
        day: str(f.day) ?? "",
        reasons: Array.isArray(f.reasons) ? f.reasons.filter((r): r is string => typeof r === "string") : [],
      })),
    },
    days: list(raw.days, (d) => ({ day: str(d.day) ?? "", exposures: cell(d.exposures), flagged: bool(d.flagged) })),
    byFormat: list(raw.byFormat, (f) => ({ format: str(f.format) ?? "unknown", exposures: cell(f.exposures), clicked: cell(f.clicked), rate: cell(f.rate), suppressed: bool(f.suppressed) })),
    byTrigger: keyRows(raw.byTrigger),
    byRoute: keyRows(raw.byRoute),
    byEscalation: keyRows(raw.byEscalation),
    variantArms: keyRows(raw.variantArms),
    droppedEvents: cell(raw.droppedEvents),
    falsePositiveReports: list(raw.falsePositiveReports, (r) => ({ reason: str(r.reason) ?? "unknown", count: cell(r.count), suppressed: bool(r.suppressed) })),
  };
}

function keyRows(x: unknown): KeyRow[] | null {
  return list(x, (r) => ({ key: str(r.key) ?? "unknown", exposures: cell(r.exposures), clicked: cell(r.clicked), rate: cell(r.rate), suppressed: bool(r.suppressed) }));
}

/* ---- wording for the Desk. The Door sends keys; these are the only words the Desk adds. ---- */

export const LABS_FORMATS: readonly string[] = ["fork", "wave"];
export const FORMAT_LABEL: Record<string, string> = {
  gate: "Gate (what is this?)",
  card: "Card (why it matters)",
  hallway: "Hallway (before you reach out)",
  door: "Open door (still open?)",
  quiet: "Quiet line",
  fork: "Fork",
  wave: "Wave",
};
export const OUTCOME_LABEL: Record<string, string> = {
  clicked_help: "Asked for help",
  left_page: "Left the page",
  dismissed: "Dismissed",
  continued: "Continued",
  timeout: "Timed out",
};
export const TRIGGER_LABEL: Record<string, string> = { search: "Search", chat: "Chat", nav: "Navigation" };
export const WORDING_LABEL: Record<string, string> = { control: "Control wording (offers the way out)", other: "Other wording" };
export const ROUTE_NONE = "xx-none";

export const hiddenText = (k: number) => `hidden: fewer than ${k}`;
export const NOT_REPORTED = "not reported by this Door";

/** A count for display. Plain digits, no separators, so the number matches the response exactly. */
export function cellText(v: Cell, k: number): string {
  if (v === undefined) return NOT_REPORTED;
  if (v === null) return hiddenText(k);
  return String(v);
}

/** A rate for display: "1.2% (3 of 250)". Hidden when the Door hid either part. */
export function rateText(rate: Cell, clicked: Cell, exposures: Cell, k: number): string {
  if (rate === undefined) return NOT_REPORTED;
  if (rate === null || typeof clicked !== "number" || typeof exposures !== "number") return hiddenText(k);
  return `${(rate * 100).toFixed(1)}% (${clicked} of ${exposures})`;
}

/* ---- the honest adoption ladder ---- */

export interface Rung { name: string; done: boolean; detail: string }
export interface Unmeasured { name: string; why: string }
export interface Ladder { level: number; rungs: Rung[]; unmeasured: Unmeasured[] }

/** Distinct production shapes (labs shapes excluded) with a visible, non-zero exposure count. */
export function visibleShapes(a: DeskAgg): number {
  const names = new Set(
    (a.byFormat ?? [])
      .filter((f) => !LABS_FORMATS.includes(f.format) && typeof f.exposures === "number" && f.exposures > 0)
      .map((f) => f.format),
  );
  return names.size;
}

/**
 * Three rungs the counter can prove from the visible numbers. A rung is ticked only when the
 * response shows it. Two rungs the counter cannot see are returned as unmeasured, never ticked.
 */
export function measuredLadder(a: DeskAgg): Ladder {
  const k = a.summary.k;
  const exposures = a.summary.exposures;
  const installed = typeof exposures === "number" && exposures > 0;
  const gateSeen = (a.byFormat ?? []).some(
    (f) => (f.format === "gate" || f.format === "card") && typeof f.exposures === "number" && f.exposures > 0,
  );
  const shapes = visibleShapes(a);
  const rungs: Rung[] = [
    {
      name: "Installed",
      done: installed,
      detail: installed
        ? `Visible exposures in this period: ${exposures}.`
        : `No visible exposures in this period (under ${k} is hidden).`,
    },
    {
      name: "Gate on",
      done: gateSeen,
      detail: gateSeen
        ? "A gate or card has a visible exposure count."
        : `No visible gate or card count: none yet, or it is hidden under ${k}.`,
    },
    {
      name: "Shift on",
      done: shapes >= 3,
      detail: shapes >= 3
        ? `${shapes} distinct shapes have visible exposures (labs shapes not counted).`
        : `${shapes} of 3 shapes have visible exposures (labs shapes not counted).`,
    },
  ];
  return {
    level: rungs.filter((r) => r.done).length,
    rungs,
    unmeasured: [
      {
        name: "Routes current",
        why: "Checking that each route is current needs a person to compare it with the service and set a review date, and the counter sees neither.",
      },
      {
        name: "Glass audited",
        why: "Whether the Glass Door panel was checked against the real request is recorded outside the counter, so the Desk cannot show it.",
      },
    ],
  };
}

/* ---- the fetch ---- */

export const MSG_OFFLINE = "Error: the demo servers are not running: npm run demo:app";
export const MSG_TOKEN = "Error: token not accepted. Check the install id and the Desk token.";
export const MSG_NOT_JSON = "Error: the answer was not the Desk's JSON. The platform may not be passing /__desk through.";
export const MSG_SHAPE = "Error: the answer did not have the shape the Desk reads.";

export type LoadResult = { ok: true; agg: DeskAgg } | { ok: false; message: string };

/**
 * GET /__desk/agg on this origin only (relative URL). The token travels in the Authorization header
 * and is never stored here; the caller keeps it in component memory.
 */
export async function loadAgg(install: string, token: string, days: number, fetchFn: typeof fetch = fetch): Promise<LoadResult> {
  const url = `/__desk/agg?i=${encodeURIComponent(install)}&days=${days}`;
  let res: Response;
  try {
    res = await fetchFn(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", credentials: "omit" });
  } catch {
    return { ok: false, message: MSG_OFFLINE };
  }
  if (res.status === 401) return { ok: false, message: MSG_TOKEN };
  if (res.status === 502 || res.status === 503 || res.status === 504) return { ok: false, message: MSG_OFFLINE };
  if (!res.ok) return { ok: false, message: `Error: the Door answered HTTP ${res.status}. Try again in a moment.` };
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return { ok: false, message: MSG_NOT_JSON };
  }
  const agg = parseAgg(raw);
  return agg ? { ok: true, agg } : { ok: false, message: MSG_SHAPE };
}
