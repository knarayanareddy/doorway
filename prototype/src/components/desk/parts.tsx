import { useState, type ReactNode } from "react";
import { Check, Copy, Lightbulb } from "lucide-react";
import { Btn } from "../ui";
import { cn } from "../../utils/cn";
import { cellText, hiddenText, rateText, type Cell } from "../../lib/liveDesk";

export const SNIPPET = `<script src="https://YOUR-CDN/doorway.min.js"
        integrity="sha384-<HASH>" crossorigin="anonymous"
        data-install="<INSTALL_ID>"
        data-trigger-event="doorway:flag" defer></script>

document.dispatchEvent(new CustomEvent('doorway:flag', { detail: { type: 'search' } }))`;

/** The install snippet with a copy button. Shared by the live and the synthetic Desk. */
export function InstallCard() {
  const [copied, setCopied] = useState(false);
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-medium">Install</h3>
        <Btn
          variant="outline"
          className="!px-3 !py-1.5 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(SNIPPET).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
        </Btn>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-night p-3 font-mono text-[11.5px] leading-5 text-paper/85">{SNIPPET}</pre>
      <p className="mt-2 text-[11px] text-ink-soft">The platform passes a trigger <em>kind</em> (search, chat, nav), never the query. Your install id and integrity hash come from npm run build; see INSTALL.md.</p>
    </section>
  );
}

/** Eyebrow + title + optional note, the section typography used across the Desk. */
export function SectionHead({ eyebrow, title, children }: { eyebrow: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft">{eyebrow}</div>
      <h2 className="font-display mt-1 text-xl font-medium">{title}</h2>
      {children && <div className="mt-1 text-sm text-ink-soft">{children}</div>}
    </div>
  );
}

export interface TableRow {
  name: string;
  tag?: string;
  exposures: Cell;
  clicked: Cell;
  rate: Cell;
}

/** A table cell. A suppressed value reads "hidden (<k)" so it fits a phone; the full wording stays in title and aria-label. */
function TableCell({ text, k }: { text: string; k: number }) {
  if (text !== hiddenText(k)) return <>{text}</>;
  return <span title={text} aria-label={text}>{`hidden (<${k})`}</span>;
}

/**
 * One breakdown table. Every cell is the Door's value, worded by the caller. `rows` is null when
 * this Door did not send the array at all; [] means it sent none for this period.
 */
export function BreakdownTable({ head, rows, k }: { head: string; rows: TableRow[] | null; k: number }) {
  if (rows === null) return <p className="text-sm text-ink-soft">{cellText(undefined, k)}.</p>;
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No data in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-soft">
            <th className="py-2 pr-3 font-semibold">{head}</th>
            <th className="py-2 pr-3 font-semibold">Exposures</th>
            <th className="py-2 pr-3 font-semibold">Help clicks</th>
            <th className="py-2 pr-3 font-semibold">Rate (clicks ÷ exposures)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-line/60 align-top">
              <td className="py-2 pr-3 font-medium">
                {r.name}
                {r.tag && <span className="ml-2 rounded bg-sky-soft px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-sky">{r.tag}</span>}
              </td>
              <td className={cn("py-2 pr-3 tabular-nums", r.exposures === null && "text-ink-soft")}><TableCell text={cellText(r.exposures, k)} k={k} /></td>
              <td className={cn("py-2 pr-3 tabular-nums", r.clicked === null && "text-ink-soft")}><TableCell text={cellText(r.clicked, k)} k={k} /></td>
              <td className={cn("py-2 pr-3 tabular-nums", (r.rate === null || r.rate === undefined) && "text-ink-soft")}><TableCell text={rateText(r.rate, r.clicked, r.exposures, k)} k={k} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The study note from the original Desk. Shown in both modes. */
export function StudyCard() {
  return (
    <section className="rounded-2xl bg-sage-soft/60 p-5 ring-1 ring-sage/25">
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-sage" />
        <div>
          <h2 className="font-display text-lg font-medium">Ship the test with the product</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">
            Nobody has tested a results-holding gate against a banner on a general platform. A study of that would have to be run per <em>platform</em>, as a stepped-wedge by cohort, so no person is ever randomised, tracked or re-identified. The live Desk does not run that comparison: the real Door has no banner, and its only split is control wording (the copy that offers the way out) against other wording, as recorded. It is not a holdout.
          </p>
        </div>
      </div>
    </section>
  );
}
