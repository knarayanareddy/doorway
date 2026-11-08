/**
 * Labs: shapes and behaviours that are built and tested but NOT part of the shipped Door,
 * because each one waits on a decision that is not engineering (docs/11-open-decisions.md).
 *
 * Nothing here is on by default. A platform opts in with data-labs="fork,wave,quick-exit" on the
 * script tag; the loader passes that to the Door, which validates it against this list.
 * The production edge still rejects the labs formats unless its LABS_FORMATS variable names them,
 * so a labs Door pointed at a production edge loses its events visibly (the Desk shows dropped
 * events) rather than polluting the aggregates.
 */
import { DEFAULT_CONFIG } from '../../core/src/shift.js';

/**
 * DEMO-ONLY labs. `advance`: every trigger shows the next step, regardless of how the last exposure ended.
 * `preview`: a forced shape, never counted. Both are Door behaviours, not formats, so they are absent from
 * LABS_FORMATS. A shipped Door must not honour them, so they exist only in a build where DEMO_LABS is on:
 * scripts/build.mjs defines __DEMO_LABS__ = true for DEMO_ROUTES=1 (the demo) and for the local harness.
 * Outside a bundle (Node, the tests) the constant is undefined, which means false.
 */
const SHIPPED_LABS = Object.freeze(['fork', 'wave', 'quick-exit']);
const DEMO_ONLY_LABS = Object.freeze(['preview', 'advance']);
/** True only in a demo build. The one place a shipped Door could gain `advance` or `preview`. */
export const DEMO_LABS = typeof __DEMO_LABS__ !== 'undefined' && __DEMO_LABS__ === true;
/** The labs a build accepts in `x=`: the shipped list, plus the demo-only ones when `demo` is true. */
export const labsFor = (demo) => (demo ? Object.freeze([...SHIPPED_LABS, ...DEMO_ONLY_LABS]) : SHIPPED_LABS);
export const LABS = labsFor(DEMO_LABS);
/** Labs that introduce a new counter format. */
export const LABS_FORMATS = Object.freeze(['fork', 'wave']);
export const PREVIEW_SHAPES = Object.freeze(['gate', 'card', 'fork', 'wave', 'hallway', 'door', 'quiet']);

/** Parses `x=`. Unknown tokens, and demo-only tokens in a shipped build, are dropped. */
export function parseLabs(value, demo = DEMO_LABS) {
  const allowed = labsFor(demo);
  const out = [];
  for (const t of String(value || '').split(',').map((x) => x.trim())) if (allowed.includes(t) && !out.includes(t)) out.push(t);
  return out;
}
export const labsFormats = (labs) => labs.filter((l) => LABS_FORMATS.includes(l));
/** The edge side: which labs formats this deployment accepts. Unset in production. */
export const edgeLabsFormats = (env) => parseLabs(env?.LABS_FORMATS).filter((l) => LABS_FORMATS.includes(l));

export function sequenceFor(labs) {
  const s = ['gate', 'card', 'hallway', 'hallway', 'door'];
  if (labs.includes('fork')) s[1] = 'fork';
  if (labs.includes('wave')) s[2] = 'wave';
  return s;
}
export const configFor = (labs, base = DEFAULT_CONFIG) => (labs.length ? { ...base, sequence: Object.freeze(sequenceFor(labs)) } : base);

/** A forced shape, for demonstrations only. Ignored unless the `preview` lab is on. */
export const previewShape = (value, labs) => (labs.includes('preview') && PREVIEW_SHAPES.includes(value) ? value : null);

export function waveSeconds(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(120, Math.max(10, n)) : 90;
}

/**
 * Quick exit. A fixed, neutral, https destination per language, chosen here and not by the host,
 * so a host cannot turn the button into a redirect of its own choosing. Requires the loader to grant
 * `allow-top-navigation-by-user-activation`, which it does only when the quick-exit lab is on.
 * replace() puts the neutral page in place of the forum page in history, so Back does not return to it.
 * Note: Escape does not count as user activation, so only a click or Enter on the button can leave.
 */
export const QUICK_EXIT = Object.freeze({ nl: 'https://www.knmi.nl/', en: 'https://www.metoffice.gov.uk/', de: 'https://www.dwd.de/' });
export const quickExitUrl = (lang) => QUICK_EXIT[lang] || QUICK_EXIT.en;
export function quickExit(win, lang) {
  try { win.top.location.replace(quickExitUrl(lang)); return true; } catch { return false; }
}

/**
 * The Wave's plan: the INDEX of a preset, never text, in sessionStorage only (gone when the tab
 * closes), under its own key. There is no free-text input anywhere.
 */
export const WAVE_KEY = 'doorway:wave:v1';
export const readWavePlan = (session) => {
  try { const v = session?.getItem(WAVE_KEY); return v === null || v === undefined ? null : (/^[0-3]$/.test(v) ? Number(v) : null); } catch { return null; }
};
export const saveWavePlan = (session, index) => { try { if (Number.isInteger(index) && index >= 0 && index <= 3) session?.setItem(WAVE_KEY, String(index)); } catch { /* no session storage */ } };
export const clearWavePlan = (session) => { try { session?.removeItem(WAVE_KEY); } catch { /* nothing to clear */ } };
