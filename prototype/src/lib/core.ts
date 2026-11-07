/**
 * Typed views of the repo's real core (plain JS with JSDoc). The functions are the real ones — only the
 * signatures are restated, because the JSDoc is narrower than what the Door actually passes
 * (resolve() takes `country`, build() takes `extraFormats`, pick() returns `acted`/`keepClock`).
 */
import { build as buildJs } from "@repo/packages/core/src/counter.js";
import { advance as advanceJs, markActed as markActedJs, pick as pickJs, variantFor as variantForJs } from "@repo/packages/core/src/shift.js";
import { resolve as resolveJs } from "@repo/packages/core/src/route.js";

/** The Counter's seven fields. There is no eighth, and no hour of day. */
export interface Payload {
  i: string;
  v: string;
  f: string;
  t: string;
  o: string;
  r: string;
  e: string;
}

/** What the Door remembers on the device: a count, the last time, recent variants, and when the person last acted. */
export interface LocalState {
  n: number;
  last: number;
  seen: string[];
  acted?: number;
}

export interface Decision {
  state: string;
  format: string;
  family: string;
  bucket: string;
  reason: string;
  /** Escalating in place or quiet: the re-warning clock is not reset. */
  keepClock?: boolean;
}

export const build = buildJs as (input: Record<string, unknown>, opts?: { extraFormats?: readonly string[] }) => { ok: true; payload: Payload } | { ok: false; errors: string[] };
export const advance = advanceJs as (state: Partial<LocalState>, variant: string, now?: number, opts?: { keepClock?: boolean }) => LocalState;
export const markActed = markActedJs as (state: Partial<LocalState>, now?: number) => LocalState;
export const pick = pickJs as (state: Partial<LocalState>, cfg: object, now?: number, opts?: { storageBlocked?: boolean }) => Decision;
export const variantFor = variantForJs as (family: string, seen?: string[]) => string;
export const resolveRoute = resolveJs as (langTag: string, table: unknown, opts: { need: string; country: string }) => { route: unknown };
