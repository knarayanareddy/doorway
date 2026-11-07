import { useCallback, useRef, useState, type ReactNode } from "react";
import { Check, Circle, Layers, Lock, ShieldCheck } from "lucide-react";
import { Btn, DoorLogo, Tag } from "../ui";
import { cn } from "../../utils/cn";
import {
  FORMAT_LABEL,
  NOT_REPORTED,
  OUTCOME_LABEL,
  ROUTE_NONE,
  TRIGGER_LABEL,
  WORDING_LABEL,
  cellText,
  hiddenText,
  loadAgg,
  measuredLadder,
  type DeskAgg,
  type KeyRow,
} from "../../lib/liveDesk";
import { BreakdownTable, InstallCard, SectionHead, StudyCard, type TableRow } from "./parts";

/** The demo install is prefilled. The token is never prefilled: the person types it or uses the demo button. Both stay in memory only. */
const DEMO_INSTALL = "inst_demo001";
const DEMO_TOKEN = "desk-demo-token";

type View = { phase: "idle" } | { phase: "loading" } | { phase: "error"; message: string } | { phase: "ok"; agg: DeskAgg };

/** Live numbers from the real Door, through /__desk/agg on this origin. Nothing loads until the person asks for it. */
export function LiveDesk() {
  const [install, setInstall] = useState(DEMO_INSTALL);
  const [token, setToken] = useState("");
  const [days, setDays] = useState(30);
  const [view, setView] = useState<View>({ phase: "idle" });
  /** Only the newest request may write the view: an older answer that arrives late is dropped. */
  const seq = useRef(0);

  const run = useCallback(async (i: string, t: string, d: number) => {
    const mine = ++seq.current;
    if (!t) {
      setView({ phase: "error", message: "Enter the Desk token, or use the demo token." });
      return;
    }
    setView({ phase: "loading" });
    const r = await loadAgg(i, t, d);
    if (mine !== seq.current) return;
    setView(r.ok ? { phase: "ok", agg: r.agg } : { phase: "error", message: r.message });
  }, []);

  const inputCls = "mt-1 w-full rounded-lg bg-paper px-3 py-2 font-mono text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-lamp";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <SectionHead eyebrow={<><ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Connect to a Door</>} title="Read the real numbers">
          The Desk asks the install&apos;s Door for its aggregates. Nothing is stored in this browser: the token lives only in this page&apos;s memory.
        </SectionHead>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void run(install.trim(), token, days);
          }}
        >
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Install id
            <input className={inputCls} value={install} onChange={(e) => setInstall(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Desk token
            <input className={inputCls} type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Period
            <select
              className={inputCls}
              value={days}
              onChange={(e) => {
                const d = Number(e.target.value);
                setDays(d);
                // Re-run only when the person has already asked for numbers in this tab.
                if (view.phase !== "idle") void run(install.trim(), token, d);
              }}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </label>
          <Btn type="submit" variant="ink" className="!py-2">Show numbers</Btn>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-ink-soft">
          <span>Demo install: the demo token is desk-demo-token (public on purpose)</span>
          <Btn type="button" className="!py-1.5 !text-[13px]" onClick={() => { setToken(DEMO_TOKEN); void run(install.trim(), DEMO_TOKEN, days); }}>
            Use the demo token
          </Btn>
        </div>
        {view.phase === "idle" && <p className="mt-3 text-sm text-ink-soft">Nothing is loaded yet. Press Show numbers, or use the demo token.</p>}
        {view.phase === "loading" && <p role="status" className="mt-3 text-sm text-ink-soft">Loading the Door&apos;s numbers…</p>}
        {view.phase === "error" && <p role="alert" className="mt-3 rounded-lg bg-clay-soft px-3 py-2 text-sm text-clay">{view.message}</p>}
      </section>

      {view.phase === "ok" && <Panels a={view.agg} days={days} install={install.trim()} />}
    </div>
  );
}

function Panels({ a, days, install }: { a: DeskAgg; days: number; install: string }) {
  const k = a.summary.k;
  const ladder = measuredLadder(a);
  const nextRung = ladder.rungs.find((r) => !r.done);
  const ct = a.summary.clickThrough;
  const label = a.summary.label ?? a.label;
  const flagged = new Map((a.summary.flaggedDays ?? []).map((f) => [f.day, f.reasons.join("; ")]));

  const rate = ct?.rate;
  let rateValue: string;
  let rateNote: string;
  if (ct === null || rate === undefined) {
    rateValue = NOT_REPORTED;
    rateNote = "This Door did not send a click-through figure.";
  } else if (rate === null) {
    rateValue = hiddenText(k);
    rateNote = "Not shown: the exposures or the help clicks are under the threshold.";
  } else {
    rateValue = `${(rate * 100).toFixed(1)}%`;
    rateNote = `${cellText(ct.clicked, k)} help clicks of ${cellText(ct.shown, k)} exposures.${ct.note ? ` ${ct.note}.` : ""}`;
  }

  return (
    <>
      {/* headline */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Headline · last {a.periodDays ?? days} days · install <span className="font-mono normal-case">{install}</span>
            </div>
            <h2 className="font-display mt-1 text-xl font-medium">What the Door counted</h2>
          </div>
          <Tag tone="clay" className="!text-[11.5px]">
            <Lock className="h-3 w-3" /> {label ?? "label not reported by this Door"}
          </Tag>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Stat
            label="Exposures"
            testid="stat-exposures"
            value={cellText(a.summary.exposures, k)}
            hidden={typeof a.summary.exposures !== "number"}
            note="Every time a warning was shown in this period, whatever the person did next."
          />
          <Stat label="Help-click rate" testid="stat-rate" value={rateValue} hidden={typeof rate !== "number"} note={rateNote} />
        </div>
        <div className="mt-5">
          <OutcomeBar outcomes={a.summary.outcomes} k={k} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        {/* honest ladder */}
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <SectionHead eyebrow={<><Layers className="mr-1 inline h-3.5 w-3.5" /> Adoption ladder · from these numbers only</>} title={`Level ${ladder.level} of 3 measured`}>
            Each rung is ticked only when the visible numbers prove it. Two rungs the counter cannot see are listed and not ticked.
          </SectionHead>
          <ol className="mt-4 space-y-2">
            {ladder.rungs.map((r) => (
              <li key={r.name} data-testid="rung" data-done={String(r.done)} className={cn("flex items-start gap-3 rounded-xl p-3 ring-1", r.done ? "bg-lamp-soft/60 ring-lamp/40" : "bg-paper ring-line")}>
                <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1", r.done ? "bg-lamp text-night ring-lamp" : "bg-white text-ink-soft ring-line")} aria-hidden="true">
                  {r.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">{r.name}: {r.done ? "done" : "not yet"}</div>
                  <p className="text-[13px] leading-snug text-ink-soft">{r.detail}</p>
                </div>
              </li>
            ))}
            {ladder.unmeasured.map((u) => (
              <li key={u.name} data-testid="not-measured" className="flex items-start gap-3 rounded-xl border border-dashed border-line bg-paper/60 p-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 ring-line bg-white text-ink-soft" aria-hidden="true">
                  <span className="text-[10px]">?</span>
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">
                    {u.name}: <span className="rounded bg-paper-2 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-ink-soft">NOT MEASURED BY THE DESK</span>
                  </div>
                  <p className="text-[13px] leading-snug text-ink-soft">{u.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* badge (honest, not public) + install */}
        <div className="space-y-6">
          <section className="rounded-2xl bg-night p-5 text-paper">
            <div className="text-xs font-semibold uppercase tracking-widest text-paper/50">Measured from this Door · not a public badge</div>
            <div className="mt-3 flex items-center gap-4 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <DoorLogo className="h-12 w-12" />
              <div className="flex-1">
                <div className="font-display text-lg leading-tight" data-testid="badge-level">Doorway · Level {ladder.level} of 3 measured</div>
                <div className="mt-1 flex gap-1" aria-label={`Level ${ladder.level} of 3 measured`}>
                  {ladder.rungs.map((r) => (
                    <span key={r.name} className={cn("h-2 w-8 rounded-full transition", r.done ? "bg-lamp shadow-[0_0_10px_rgba(232,163,61,0.7)]" : "bg-white/15")} />
                  ))}
                </div>
                <div className="mt-1.5 text-[11px] text-paper/55">
                  {nextRung ? `Next: ${nextRung.name}` : "All three rungs this Desk can measure are ticked."}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-paper/60">
              The level counts only what the numbers above prove. It is not a certificate, not a public badge and not a ranking. Routes current and Glass audited are not measured here.
            </p>
          </section>
          <InstallCard />
        </div>
      </div>

      {/* breakdowns */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <SectionHead eyebrow="By shape" title="What each warning shape saw">
          Rates are over every exposure of that shape, including people who left.
        </SectionHead>
        <div className="mt-4">
          <BreakdownTable
            head="Shape"
            k={k}
            rows={a.byFormat?.map((f): TableRow => ({
              name: FORMAT_LABEL[f.format] ?? f.format,
              exposures: f.exposures,
              clicked: f.clicked,
              rate: f.rate,
            })) ?? null}
          />
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel eyebrow="Which triggers" title="How the warning was started">
          <BreakdownTable head="Trigger" k={k} rows={mapRows(a.byTrigger, (key) => TRIGGER_LABEL[key] ?? key)} />
        </Panel>
        <Panel eyebrow="Where people were sent" title="Which help link the warning pointed to">
          <BreakdownTable head="Route" k={k} rows={mapRows(a.byRoute, (key) => (key === ROUTE_NONE ? "No route shown" : key))} />
        </Panel>
        <Panel eyebrow="How far the escalation went" title="Steps shown before the person stopped">
          <BreakdownTable head="Step" k={k} rows={mapRows(a.byEscalation, (key) => (key === "5+" ? "Step 5 or more" : `Step ${key}`))} />
        </Panel>
        <Panel eyebrow="Control wording vs other wording" title="Compared as recorded">
          <p className="mb-3 text-[13px] leading-relaxed text-ink-soft">
            Observational, not a randomised test. Wording is set per copy family, so any gap may come from the shapes, the platform or the people, and shows no cause.
          </p>
          <BreakdownTable head="Wording" k={k} rows={mapRows(a.variantArms, (key) => WORDING_LABEL[key] ?? key)} />
        </Panel>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* days */}
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <SectionHead eyebrow="Days" title="Day by day">
            Flagged days are shown and labelled, and they are left out of the headline numbers.
          </SectionHead>
          {a.days !== null && a.days.some((d) => d.flagged) && (
            <p className="mt-3 text-sm font-medium text-clay">
              Flagged: {a.days.filter((d) => d.flagged).map((d) => d.day).join(", ")}. Highlighted below.
            </p>
          )}
          <div className="mt-4">
            {a.days === null ? (
              <p className="text-sm text-ink-soft">{NOT_REPORTED}.</p>
            ) : a.days.length === 0 ? (
              <p className="text-sm text-ink-soft">No data in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-soft">
                    <th className="py-2 pr-3 font-semibold">Day</th>
                    <th className="py-2 pr-3 font-semibold">Exposures</th>
                    <th className="py-2 pr-3 font-semibold">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {a.days.map((d) => (
                    <tr key={d.day} data-testid={d.flagged ? "flagged-day" : undefined} className={cn("border-b border-line/60", d.flagged && "bg-clay-soft/60")}>
                      <td className="py-1.5 pr-3 font-mono text-xs">{d.day}</td>
                      <td className={cn("py-1.5 pr-3 tabular-nums", d.exposures === null && "text-ink-soft")}>{cellText(d.exposures, k)}</td>
                      <td className="py-1.5 pr-3 text-xs text-clay">{d.flagged ? `flagged: ${flagged.get(d.day) || "reason not reported"}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
            <SectionHead eyebrow="Events" title="Events the Door could not send">
              Counted by the install&apos;s page and reported back. When this is above zero the counts above may be low.
            </SectionHead>
            <p className="mt-3 text-sm" data-testid="dropped">
              {a.droppedEvents === undefined
                ? NOT_REPORTED + "."
                : typeof a.droppedEvents === "number" && a.droppedEvents > 0
                  ? `${a.droppedEvents} events could not be sent, so the counts above may be low.`
                  : a.droppedEvents === null
                    ? hiddenText(k)
                    : "None reported."}
            </p>
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
            <SectionHead eyebrow="Reports" title="Mistaken-warning reports">
              A person said the warning was not meant for them and gave one reason from a fixed list.
            </SectionHead>
            <div className="mt-3">
              {a.falsePositiveReports === null ? (
                <p className="text-sm text-ink-soft">{NOT_REPORTED}.</p>
              ) : a.falsePositiveReports.length === 0 ? (
                <p className="text-sm text-ink-soft">No reports in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-soft">
                      <th className="py-2 pr-3 font-semibold">Reason</th>
                      <th className="py-2 pr-3 font-semibold">Reports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.falsePositiveReports.map((r) => (
                      <tr key={r.reason} className="border-b border-line/60">
                        <td className="py-1.5 pr-3">{r.reason}</td>
                        <td className={cn("py-1.5 pr-3 tabular-nums", r.count === null && "text-ink-soft")}>{cellText(r.count, k)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-2xl bg-clay-soft/60 p-5 text-[13px] leading-relaxed text-ink ring-1 ring-clay/20">
        <div className="mb-2 font-semibold text-clay">What this dashboard cannot tell you</div>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>The numbers are self-reported by the install&apos;s own page and are not authenticated. Anyone who can run that page can send counts for it.</li>
          <li>There is no time of day. Counts are per calendar day, so nothing shows when in the day anyone was warned.</li>
          <li>It cannot tell people apart. There are no person ids, sessions or timestamps finer than a day.</li>
          <li>Small cells are hidden (under {k}), and one more visible cell in each table is hidden too, so a hidden value cannot be worked out by subtracting from a total.</li>
          <li>Click-through is not proof that anyone got help. A click does not show a conversation, a referral or an outcome.</li>
        </ul>
      </section>

      <StudyCard />
    </>
  );
}

/** Map the Door's breakdown rows to table rows; null stays null (not reported). */
function mapRows(rows: KeyRow[] | null, labelOf: (key: string) => string): TableRow[] | null {
  return rows?.map((r) => ({ name: labelOf(r.key), exposures: r.exposures, clicked: r.clicked, rate: r.rate })) ?? null;
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-line">
      <SectionHead eyebrow={eyebrow} title={title} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, note, hidden, testid }: { label: string; value: string; note: string; hidden: boolean; testid: string }) {
  return (
    <div className="rounded-xl bg-paper p-4 ring-1 ring-line">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</div>
      <div data-testid={testid} className={cn("font-display mt-1 tabular-nums", hidden ? "text-base text-ink-soft" : "text-3xl text-ink")}>{value}</div>
      <p className="mt-1.5 text-[12px] leading-snug text-ink-soft">{note}</p>
    </div>
  );
}

const OUTCOME_CLASS: Record<string, string> = {
  clicked_help: "bg-lamp",
  left_page: "bg-sage",
  dismissed: "bg-line",
  continued: "bg-sky",
  timeout: "bg-clay",
};

/** Stacked bar of the headline outcomes. Hidden cells are not drawn; they are named in the legend. */
function OutcomeBar({ outcomes, k }: { outcomes: DeskAgg["summary"]["outcomes"]; k: number }) {
  if (outcomes === null) return <p className="text-sm text-ink-soft">{NOT_REPORTED}.</p>;
  const visible = outcomes.filter((o): o is typeof o & { count: number } => typeof o.count === "number" && o.count > 0);
  const total = visible.reduce((a, o) => a + o.count, 0);
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Outcome mix</div>
      {total === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">No outcomes to show in this period.</p>
      ) : (
        <div className="mt-2 flex h-4 overflow-hidden rounded-full ring-1 ring-line" role="img" aria-label="Outcome mix, visible counts only">
          {visible.map((o) => (
            <div key={o.outcome} className={OUTCOME_CLASS[o.outcome] ?? "bg-ink-soft"} style={{ flexGrow: o.count }} title={`${OUTCOME_LABEL[o.outcome] ?? o.outcome}: ${o.count}`} />
          ))}
        </div>
      )}
      <ul className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-ink-soft sm:grid-cols-2">
        {outcomes.map((o) => (
          <li key={o.outcome} className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", OUTCOME_CLASS[o.outcome] ?? "bg-ink-soft")} aria-hidden="true" />
            <span>{OUTCOME_LABEL[o.outcome] ?? o.outcome}</span>
            <span className={cn("ml-auto tabular-nums", typeof o.count === "number" ? "text-ink" : "text-ink-soft")}>{cellText(o.count, k)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
