/**
 * Shape metadata for the prototype. Scheduling, counter validation and copy all come from the
 * real packages; this file only holds what the screen needs (labels, the demo sequence).
 *
 * The shipped Door runs gate, card, hallway, hallway, door. The prototype ALSO demos two RESERVED
 * shapes, fork and wave, so it passes its own sequence to core pick() and its own `extraFormats` to
 * build(). The edge never accepts those two.
 */
import { DEFAULT_CONFIG, bucketOf } from "@repo/packages/core/src/shift.js";

export type Shape = "gate" | "card" | "fork" | "wave" | "hallway" | "door" | "quiet" | "banner";
export type Family = "legal" | "harm" | "control";
export type Bucket = "1" | "2" | "3" | "4" | "5+";
export type Outcome = "clicked_help" | "left_page" | "dismissed" | "continued" | "timeout";

export const SEQUENCE = ["gate", "fork", "wave", "hallway", "door"] as const;
export const RESERVED: readonly Shape[] = ["fork", "wave"];
export const EXTRA_FORMATS = ["fork", "wave"];
export const ACTED: readonly Outcome[] = ["clicked_help", "dismissed", "continued"];

export const SHAPES: Record<Shape, { label: string; question: string }> = {
  gate: { label: "Gate", question: "What is this?" },
  card: { label: "Card", question: "(degraded: storage unavailable)" },
  fork: { label: "Fork", question: "Where do I stand?" },
  wave: { label: "Wave", question: "What do I do with this urge?" },
  hallway: { label: "Hallway", question: "What happens if I reach out?" },
  door: { label: "Open door", question: "Is it still open?" },
  quiet: { label: "Quiet line", question: "(inside the re-warning window)" },
  banner: { label: "Banner (control arm)", question: "(what everyone else ships)" },
};

/** Demo mode lets every fire advance the Shift; realistic mode keeps the shipped 10 min / 6 h / 72 h windows. */
export const configFor = (realistic: boolean) => ({
  ...DEFAULT_CONFIG,
  sequence: [...SEQUENCE],
  ...(realistic ? {} : { intervalHours: [0, 0, 0, 0] }),
});

/** The banner is the control arm's `card` on the wire. */
export const wireFormat = (shape: Shape) => (shape === "banner" ? "card" : shape);
export const familyOf = (shape: Shape): Family => (shape === "banner" ? DEFAULT_CONFIG.families.card : DEFAULT_CONFIG.families[shape]) as Family;

export interface ShapePick {
  shape: Shape;
  bucket: Bucket;
  family: Family;
  variant: string;
  state: string;
  reason?: string;
  /** Escalated in place inside the re-warning window: results are not held, the clock was not reset. */
  inline?: boolean;
}

export const firstBucket = (n: number) => bucketOf(n) as Bucket;
