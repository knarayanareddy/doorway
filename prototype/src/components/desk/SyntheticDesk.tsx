import { useState } from "react";
import { Check, Layers, Lock } from "lucide-react";
import { UNAUTHENTICATED_LABEL, ctr, suppress } from "@repo/packages/core/src/counter.js";
import { DoorLogo, Tag } from "../ui";
import { cn } from "../../utils/cn";
import { InstallCard, StudyCard } from "./parts";

/** k-anonymity threshold; the same default as the real Desk read model. */
const K = 10;
/** The real suppress() works on rows; this is one count at a time. */
const cell = (count: number): number | null => suppress([{ count }], K)[0].count;

/* ---- synthetic 7-day aggregate for a 20,000-member forum. Baselines follow the dossier's honest range
        (0.5–1.5%), not the organiser demo tool's 15%. Labelled SYNTHETIC on screen. ---- */
const SYN = [
  { shape: "Gate", exposures: 1240, help: 11 },
  { shape: "Fork", exposures: 620, help: 11 },
  { shape: "Wave", exposures: 310, help: 6 },
  { shape: "Hallway", exposures: 190, help: 5 },
  { shape: "Open door", exposures: 96, help: 2 },
  { shape: "Quiet line", exposures: 1410, help: 4 },
];
const SYN_OUTCOMES = [
  { k: "left_page", n: 1382, c: "bg-sage" },
  { k: "continued", n: 497, c: "bg-sky" },
  { k: "dismissed", n: 544, c: "bg-line" },
  { k: "clicked_help", n: 33, c: "bg-lamp" },
];

const RUNGS = [
  { name: "Installed", body: "Script tag live; install verified by a DNS record or meta tag. Only verified installs can write." },
  { name: "Gate on", body: "Results are held until the person acts — a gate, not a banner beside the results. Always on in this illustration.", fixed: true },
  { name: "Shift on", body: "The shape sequence is on, so the fifth exposure is not the first one again." },
  { name: "Routes current", body: "Signed routes bundle < 30 days old; a named contact exists at each service in the table." },
  { name: "Glass-audited", body: "Privacy gate green in CI and a public receipt page lists the seven fields. Anyone can check." },
];

/** The synthetic view: numbers computed in this browser from invented rates. Never from a Door. */
export function SyntheticDesk() {
  /** The ladder ticks are the reader's own toggles in this illustration. Nothing here is counted or saved. */
  const [ladder, setLadder] = useState([true, true, true, false, false]);
  const rungs = RUNGS.map((r, i) => (r.fixed ? true : ladder[i]));
  let level = 0;
  while (level < rungs.length && rungs[level]) level++;

  const toggle = (i: number) => setLadder((l) => l.map((v, j) => (j === i ? !v : v)));

  const totalSyn = SYN.filter((x) => x.shape !== "Quiet line").reduce((a, b) => a + b.exposures, 0);
  const outTotal = SYN_OUTCOMES.reduce((a, b) => a + b.n, 0);

  return (
    <div className="space-y-6">
      <div role="note" className="flex flex-wrap items-center gap-3 rounded-2xl bg-clay-soft/70 p-4 ring-1 ring-clay/25">
        <Tag tone="clay">SYNTHETIC</Tag>
        <p className="text-sm text-ink">
          Invented numbers, computed in this browser from assumed rates for a 20,000-member forum. They are <strong>not</strong> from any Door and show no real platform.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* Ladder */}
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-lamp-deep"><Layers className="h-3.5 w-3.5" /> The Open Door Ladder · illustrative</div>
              <h2 className="font-display mt-1 text-xl font-medium">Gamification for the people with the power to adopt</h2>
              <p className="mt-1 text-sm text-ink-soft">
                The real blocker is voluntary adoption at the long tail. So the game is for <em>operators</em>: five checkable criteria earn a public, verifiable badge. Criteria, not competition — nobody is ranked against anybody.
              </p>
              <p className="mt-2 text-xs text-ink-soft">Illustrative: this five-level ladder is a design sketch. Only the first three rungs can be measured from the Door (see the live view).</p>
            </div>
          </div>

          <ol className="mt-4 space-y-2">
            {RUNGS.map((r, i) => {
              const on = rungs[i];
              return (
                <li key={r.name} className={cn("flex items-start gap-3 rounded-xl p-3 ring-1 transition", on ? "bg-lamp-soft/60 ring-lamp/40" : "bg-paper ring-line")}>
                  <button
                    disabled={r.fixed}
                    onClick={() => toggle(i)}
                    aria-pressed={on}
                    aria-label={`${r.name}: ${on ? "done" : "not done"}`}
                    className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 transition", on ? "bg-lamp text-night ring-lamp" : "bg-white text-transparent ring-line hover:ring-ink-soft", r.fixed && "cursor-default")}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{i + 1}. {r.name} {r.fixed && <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-ink-soft">fixed</span>}</div>
                    <p className="text-[13px] leading-snug text-ink-soft">{r.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Badge + install */}
        <div className="space-y-6">
          <section className="rounded-2xl bg-night p-5 text-paper">
            <div className="text-xs font-semibold uppercase tracking-widest text-paper/50">Illustrative badge · not published, not checkable at /v1/status</div>
            <div className="mt-3 flex items-center gap-4 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <DoorLogo className="h-12 w-12" />
              <div className="flex-1">
                <div className="font-display text-lg leading-tight">Doorway · Level {level} of 5 (illustrative)</div>
                <div className="mt-1 flex gap-1" aria-label={`Level ${level} of 5, illustrative`}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className={cn("h-2 w-8 rounded-full transition", i < level ? "bg-lamp shadow-[0_0_10px_rgba(232,163,61,0.7)]" : "bg-white/15")} />
                  ))}
                </div>
                <div className="mt-1.5 text-[11px] text-paper/55">{level === 5 ? "All five criteria checkable by anyone." : `Next: ${RUNGS[level].name}`}</div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-paper/60">
              Why a badge works here: it is a signal <em>to users</em> that this platform has a door — and an artefact that may be useful as supporting material for platform risk assessments — to be checked with counsel. It carries no ranking and no data.
            </p>
          </section>

          <InstallCard />
        </div>
      </div>

      {/* Aggregates */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft"><Lock className="h-3.5 w-3.5" /> Aggregates · last 7 days · cells below {K} are suppressed</div>
            <h2 className="font-display mt-1 text-xl font-medium">What a 20,000-member forum actually sees</h2>
            <p className="mt-1 text-xs text-ink-soft">{UNAUTHENTICATED_LABEL}</p>
          </div>
          <Tag tone="clay">SYNTHETIC — baselines 0.5–1.5%, not 15%</Tag>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-soft">
                <th className="py-2 pr-3 font-semibold">Shape</th>
                <th className="py-2 pr-3 font-semibold">Exposures</th>
                <th className="py-2 pr-3 font-semibold">Help clicks</th>
                <th className="py-2 pr-3 font-semibold">Rate (clicks ÷ exposures)</th>
              </tr>
            </thead>
            <tbody>
              {SYN.map((r) => {
                const help = cell(r.help);
                const c = help == null ? null : ctr(help, r.exposures);
                return (
                  <tr key={r.shape} className="border-b border-line/60">
                    <td className="py-2.5 pr-3 font-medium">{r.shape}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 rounded-full bg-paper-2"><div className="h-2 rounded-full bg-sky" style={{ width: `${(r.exposures / 1500) * 100}%` }} /></div>
                        <span className="tabular-nums">{r.exposures.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{help ?? <span className="rounded bg-paper-2 px-1.5 py-0.5 text-xs text-ink-soft">&lt;{K}</span>}</td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {c?.rate != null ? (
                        <>
                          {(c.rate * 100).toFixed(2)}% <span className="text-xs text-ink-soft">({help}/{r.exposures.toLocaleString()})</span>
                        </>
                      ) : (
                        <span className="text-ink-soft">— suppressed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">Outcome mix · {outTotal.toLocaleString()} of {totalSyn.toLocaleString()} shown exposures</div>
            <div className="flex h-4 overflow-hidden rounded-full ring-1 ring-line">
              {SYN_OUTCOMES.map((o) => (
                <div key={o.k} className={o.c} style={{ width: `${(o.n / outTotal) * 100}%` }} title={o.k} />
              ))}
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-soft">
              {SYN_OUTCOMES.map((o) => (
                <li key={o.k} className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", o.c)} /> {o.k} <span className="ml-auto tabular-nums text-ink">{((o.n / outTotal) * 100).toFixed(1)}%</span></li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-clay-soft/60 p-4 text-[13px] leading-relaxed text-ink ring-1 ring-clay/20">
            <div className="mb-1 font-semibold text-clay">What this dashboard cannot tell you</div>
            Whether anyone stopped. Whether “left page” means they went somewhere else. Ahmia randomised 3.1 million warnings over 140 days and found no detectable reduction in searching — so The Desk reports <strong>help contact</strong>, not deterrence, and shows every numerator over its denominator.
          </div>
        </div>
      </section>

      <StudyCard />
    </div>
  );
}
