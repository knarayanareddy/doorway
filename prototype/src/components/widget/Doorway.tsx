import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, ArrowLeft, DoorOpen, LogOut, X, ScanEye, Users, Baby, Briefcase, HeartHandshake, Hand, Compass } from "lucide-react";
import { isRenderableHours, openStatus } from "@repo/packages/core/src/hours.js";
import { legalRecordFor } from "@repo/packages/core/src/legal.js";
import { HALLWAY_FAQ, LABELS, QUIET, copyFor, langOf, variantIndex } from "@repo/packages/doorway/src/copy.js";
import { COPY, type Lang } from "../../lib/content";
import { LEGAL_JURISDICTION, routeId, type Route } from "../../lib/routes";
import { RESERVED, SEQUENCE, SHAPES, wireFormat, type Bucket, type Family, type Outcome, type Shape } from "../../lib/shapes";
import { SYNTHETIC_NOTE } from "../../lib/synthetic";
import type { Payload } from "../../lib/core";
import { ALink, Btn, DoorLogo, Tag } from "../ui";
import { Glass } from "./Glass";
import { Hallway } from "./Hallway";
import { Wave } from "./Wave";

type View = "gate" | "card" | "fork" | "wave" | "hallway" | "door" | "accident" | "work" | "young" | "other";

export interface DoorwayProps {
  shape: Shape;
  bucket: Bucket;
  family: Family;
  variant: string;
  inline: boolean;
  lang: Lang;
  synthetic: boolean;
  routes: { primary: Route | null; selfhelp: Route | null };
  legalRecords: object[];
  fastWave: boolean;
  n: number;
  plan: string | null;
  sent: Payload | null;
  preview: boolean;
  onOutcome: (o: Outcome, route?: string) => void;
  onHelp: (routeId: string) => void;
  onSavePlan: (p: string | null) => void;
  onWipe: () => void;
  onQuickExit: () => void;
}

export function Doorway(props: DoorwayProps) {
  const now = useMemo(() => Date.now(), []);
  const body = props.shape === "quiet" ? <Quiet {...props} /> : props.shape === "banner" ? <Banner {...props} /> : props.shape === "door" ? <OpenDoor {...props} now={now} /> : <Shell {...props} now={now} />;
  return <div data-testid="doorway" data-shape={props.shape}>{body}</div>;
}

/** The three-variant copy for a shape, from the real copy.js. The variant id picks which of the three. */
function copyOf(p: DoorwayProps, format: string, family: Family, now: number) {
  const variants = copyFor({ format, family, lang: p.lang, route: p.routes.primary, legalJurisdiction: LEGAL_JURISDICTION, now, legalRecords: p.legalRecords });
  return variants[variantIndex(p.variant)] || variants[0];
}

const previewOf = (p: DoorwayProps): Record<string, string | null> => ({
  i: "inst_demo0001",
  v: p.variant,
  f: wireFormat(p.shape),
  t: "search",
  o: null,
  r: routeId(p.routes.primary),
  e: p.bucket,
});

function Notes({ p }: { p: DoorwayProps }) {
  const t = COPY[p.lang].chrome;
  return (
    <div className="relative flex flex-wrap gap-1.5 px-4 pt-3 md:px-6">
      {(RESERVED as readonly string[]).includes(p.shape) && <Tag tone="lamp">{t.reserved}</Tag>}
      {p.inline && <Tag tone="night">{t.inline}</Tag>}
      {p.synthetic && <Tag tone="clay">Reviewed-claims preview (SYNTHETIC) · {SYNTHETIC_NOTE[p.lang]}</Tag>}
    </div>
  );
}

/* ---------- shared shell for the four results-holding shapes ---------- */
function Shell(p: DoorwayProps & { now: number }) {
  const t = COPY[p.lang];
  const [view, setView] = useState<View>(p.shape as View);
  const [glass, setGlass] = useState(false);
  const idx = SEQUENCE.indexOf(p.shape as (typeof SEQUENCE)[number]) + 1;

  const draft = previewOf(p);
  const { primary, selfhelp } = p.routes;
  const hallwayCopy = copyOf(p, "hallway", "control", p.now);
  const legalApplied = !!legalRecordFor(LEGAL_JURISDICTION, p.legalRecords, p.now);

  let body: ReactNode;
  switch (view) {
    case "gate":
      body = <Gate lang={p.lang} copy={copyOf(p, "gate", "legal", p.now)} legalBy={legalApplied ? legalRecordFor(LEGAL_JURISDICTION, p.legalRecords, p.now).reviewedBy : null} onLeave={() => p.onOutcome("left_page")} onHelp={() => setView("hallway")} onContinue={() => p.onOutcome("continued")} />;
      break;
    case "card":
      body = <Card lang={p.lang} copy={copyOf(p, "card", "harm", p.now)} onLeave={() => p.onOutcome("left_page")} onHelp={() => setView("hallway")} />;
      break;
    case "fork":
      body = <Fork lang={p.lang} go={setView} />;
      break;
    case "wave":
      body = (
        <Wave lang={p.lang} fast={p.fastWave} initialPlan={p.plan} onSavePlan={p.onSavePlan} onTalk={() => setView("hallway")} onLeave={() => p.onOutcome("left_page")} />
      );
      break;
    case "hallway":
      body = <Hallway lang={p.lang} title={hallwayCopy.h} sub={hallwayCopy.b} route={primary} selfhelp={selfhelp} onHelp={p.onHelp} onLeave={() => p.onOutcome("left_page")} />;
      break;
    case "accident":
      body = <Info title={t.fork.accidentTitle} text={t.fork.accidentBody}>
        <Btn variant="lamp" onClick={() => p.onOutcome("left_page")}>{t.fork.accidentBack}</Btn>
        <Btn variant="soft" onClick={() => setView("hallway")}>{t.fork.accidentHelp}</Btn>
      </Info>;
      break;
    case "work":
      body = <Info title={t.fork.workTitle} text={t.fork.workBody}>
        <Btn variant="lamp" onClick={() => p.onOutcome("continued")}>{t.fork.workGo}</Btn>
      </Info>;
      break;
    case "young":
      body = <Info title={t.fork.youngTitle} text={t.fork.youngBody} devNote={t.fork.youngDevNote}>
        <Btn variant="lamp" onClick={() => p.onOutcome("left_page")}>{t.fork.youngBack}</Btn>
      </Info>;
      break;
    case "other":
      body = <Info title={t.fork.otherTitle} text={t.fork.otherBody}>
        <Btn variant="lamp" onClick={() => setView("hallway")}>{t.fork.otherGo} <ArrowRight className="h-4 w-4" /></Btn>
      </Info>;
      break;
    default:
      body = null;
  }

  const showBack = view !== p.shape;

  return (
    <section
      className="dw-rise relative overflow-hidden rounded-2xl bg-night text-paper shadow-[0_30px_80px_-30px_rgba(14,26,36,0.9)] ring-1 ring-white/10"
      aria-label="Doorway"
    >
      <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-lamp/15 blur-3xl" />
      {/* header */}
      <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2.5">
          <DoorLogo className="h-6 w-6" />
          <span className="font-display text-base font-medium">{t.chrome.brand}</span>
          {idx > 0 && (
            <Tag tone="night" className="hidden sm:inline-flex">
              {p.preview ? "preview · " : ""}
              {SHAPES[p.shape].label} · {idx}/5
            </Tag>
          )}
        </div>
        <button
          onClick={p.onQuickExit}
          title={t.chrome.quickExitHint}
          className="inline-flex items-center gap-1.5 rounded-lg bg-clay px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#c9654b]"
        >
          <LogOut className="h-3.5 w-3.5" /> {t.chrome.quickExit}
        </button>
      </div>

      <Notes p={p} />
      <div className="relative px-4 py-5 md:px-6 md:py-6">
        {showBack && (
          <button onClick={() => setView(p.shape as View)} className="mb-3 inline-flex items-center gap-1 text-xs text-paper/60 hover:text-paper">
            <ArrowLeft className="h-3.5 w-3.5" /> {t.chrome.back}
          </button>
        )}
        {body}
      </div>

      {/* footer: the Glass Door */}
      <div className="relative border-t border-white/10 px-4 py-3 md:px-6">
        <button
          onClick={() => setGlass((g) => !g)}
          aria-expanded={glass}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-medium text-lamp transition hover:bg-lamp/10"
        >
          <ScanEye className="h-4 w-4" /> {t.chrome.glass}
        </button>
        <span className="ml-2 text-[11px] text-paper/40">{t.chrome.heldNote}</span>
        {glass && (
          <div className="mt-3">
            <Glass lang={p.lang} draft={draft} sent={p.sent} n={p.n} plan={p.plan} legalSynthetic={legalApplied} onWipe={p.onWipe} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- views ---------- */
function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lamp">{kicker}</div>
      <h2 className="font-display mt-2 text-2xl font-medium leading-snug text-paper md:text-[28px]">{title}</h2>
    </>
  );
}

function Gate({ lang, copy, legalBy, onLeave, onHelp, onContinue }: { lang: Lang; copy: { h: string; b: string }; legalBy: string | null; onLeave: () => void; onHelp: () => void; onContinue: () => void }) {
  const t = COPY[lang].gate;
  const [wait, setWait] = useState(5);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  return (
    <div className="dw-rise">
      <Heading kicker={t.kicker} title={copy.h} />
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-paper/85">{copy.b}</p>
      {legalBy && <p className="mt-2"><Tag tone="clay">{t.legalTag(legalBy)}</Tag></p>}
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper/60">{t.accident}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Btn variant="lamp" onClick={onLeave}>{t.back}</Btn>
        <Btn variant="soft" onClick={onHelp}>{t.help} <ArrowRight className="h-4 w-4" /></Btn>
        <Btn variant="ghost" disabled={wait > 0} onClick={onContinue} className="ml-auto text-paper/55">
          {wait > 0 ? t.mistakeWait(wait) : t.mistake}
        </Btn>
      </div>
    </div>
  );
}

/** Format `card` (harm copy): what a degraded exposure shows when the device cannot remember anything. */
function Card({ lang, copy, onLeave, onHelp }: { lang: Lang; copy: { h: string; b: string }; onLeave: () => void; onHelp: () => void }) {
  const t = COPY[lang].card;
  return (
    <div className="dw-rise">
      <Heading kicker={t.kicker} title={copy.h} />
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-paper/85">{copy.b}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Btn variant="lamp" onClick={onLeave}>{t.back}</Btn>
        <Btn variant="soft" onClick={onHelp}>{t.help} <ArrowRight className="h-4 w-4" /></Btn>
      </div>
    </div>
  );
}

const forkIcons = { accident: Hand, stop: HeartHandshake, cantstop: Compass, other: Users, young: Baby, work: Briefcase } as const;

function Fork({ lang, go }: { lang: Lang; go: (v: View) => void }) {
  const t = COPY[lang].fork;
  const dest: Record<keyof typeof t.options, View> = { accident: "accident", stop: "hallway", cantstop: "wave", other: "other", young: "young", work: "work" };
  return (
    <div className="dw-rise">
      <Heading kicker={t.kicker} title={t.title} />
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-paper/65">{t.sub}</p>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {(Object.keys(t.options) as (keyof typeof t.options)[]).map((k) => {
          const Icon = forkIcons[k];
          return (
            <button
              key={k}
              onClick={() => go(dest[k])}
              className="group flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3.5 text-left text-[15px] text-paper ring-1 ring-white/10 transition hover:bg-lamp/10 hover:ring-lamp/50"
            >
              <Icon className="h-5 w-5 shrink-0 text-lamp" />
              <span className="flex-1">{t.options[k]}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-paper/30 transition group-hover:translate-x-0.5 group-hover:text-lamp" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Info({ title, text, devNote, children }: { title: string; text: string; devNote?: string; children: ReactNode }) {
  return (
    <div className="dw-rise">
      <h2 className="font-display text-2xl font-medium leading-snug text-paper md:text-[28px]">{title}</h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-paper/80">{text}</p>
      {devNote && <p className="mt-3 max-w-2xl rounded-lg bg-white/5 px-3 py-2 text-xs leading-relaxed text-paper/60 ring-1 ring-white/10">{devNote}</p>}
      <div className="mt-5 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/* ---------- shape 5: the open door (presence, not pressure) ---------- */
function OpenDoor(p: DoorwayProps & { now: number }) {
  const t = COPY[p.lang];
  const L = langOf(p.lang) as Lang;
  const { primary, selfhelp } = p.routes;
  const copy = copyOf(p, "door", "control", p.now);
  // Open/closed is shown only for a route whose hours were verified recently; otherwise nothing.
  const status = primary && isRenderableHours(primary, p.now) ? openStatus(primary.hours, new Date(p.now)) : null;
  const closed = !!status && !status.open && !!selfhelp && selfhelp.id !== primary?.id;
  const other = selfhelp && selfhelp.id !== primary?.id ? selfhelp : null;
  const [glass, setGlass] = useState(false);
  return (
    <section className="dw-rise relative overflow-hidden rounded-2xl bg-night text-paper shadow-xl ring-1 ring-white/10" aria-label="Doorway">
      <div className="pointer-events-none absolute -left-10 top-0 h-full w-1/2 bg-gradient-to-r from-lamp/20 to-transparent" />
      <Notes p={p} />
      <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:p-6">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-lamp/15 text-lamp">
          <DoorOpen className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lamp">{t.door.kicker}</div>
          <h2 className="font-display mt-1 text-xl font-medium leading-snug md:text-2xl">{copy.h}</h2>
          <p className="mt-1 text-sm text-paper/70">{copy.b}</p>
          {status && <p className="mt-1 text-xs text-paper/60">{status.open ? HALLWAY_FAQ.openUntil[L](status.closesAt) : HALLWAY_FAQ.closedOpens[L](status.opensAt)}</p>}
          {closed && <p className="mt-1 text-xs text-lamp">{HALLWAY_FAQ.closedTip[L]}</p>}
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          {primary && !closed && (
            <>
              <ALink variant="lamp" href={primary.url} target="_blank" rel="noopener noreferrer" onClick={() => p.onHelp(primary.id)} className="!py-3 text-base">
                {LABELS.primary[L]}
              </ALink>
              {primary.phone && <span className="text-xs text-paper/70">{primary.phone}</span>}
            </>
          )}
          {other && (
            <ALink variant={closed ? "lamp" : "ghost"} href={other.url} target="_blank" rel="noopener noreferrer" onClick={() => p.onHelp(other.id)} className={closed ? "!py-3" : undefined}>
              {t.hallway.selfhelp}
            </ALink>
          )}
        </div>
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-5 py-2.5 md:px-6">
        <button onClick={() => setGlass((g) => !g)} aria-expanded={glass} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-lamp hover:bg-lamp/10">
          <ScanEye className="h-4 w-4" /> {t.chrome.glass}
        </button>
        <div className="flex items-center gap-2">
          <Btn variant="ghost" className="!py-1 text-xs" onClick={() => p.onOutcome("dismissed")}>{t.door.carryOn}</Btn>
          <button onClick={p.onQuickExit} className="inline-flex items-center gap-1.5 rounded-lg bg-clay px-2.5 py-1 text-[11px] font-semibold text-white"><LogOut className="h-3 w-3" /> {t.chrome.quickExit}</button>
        </div>
      </div>
      {glass && (
        <div className="relative px-5 pb-5 md:px-6">
          <Glass lang={p.lang} draft={previewOf(p)} sent={p.sent} n={p.n} plan={p.plan} legalSynthetic={!!legalRecordFor(LEGAL_JURISDICTION, p.legalRecords, p.now)} onWipe={p.onWipe} />
        </div>
      )}
    </section>
  );
}

/* ---------- quiet line: inside the re-warning window, and the person already acted ---------- */
function Quiet(p: DoorwayProps) {
  const L = langOf(p.lang) as Lang;
  const { primary } = p.routes;
  const line = QUIET[L][variantIndex(p.variant)] || QUIET[L][0];
  return (
    <div className="dw-rise flex flex-wrap items-center gap-3 rounded-xl bg-night px-4 py-2.5 text-sm text-paper ring-1 ring-white/10">
      <DoorLogo className="h-5 w-5" />
      <span className="flex-1 text-paper/85">{line.h}</span>
      {primary && (
        <a href={primary.url} target="_blank" rel="noopener noreferrer" onClick={() => p.onHelp(primary.id)} className="font-medium text-lamp underline-offset-4 hover:underline">
          {LABELS.primary[L]} →
        </a>
      )}
    </div>
  );
}

/* ---------- control arm: what everyone else ships — a plain banner beside the results, no legal or privacy assertion ---------- */
function Banner(p: DoorwayProps) {
  const t = COPY[p.lang].banner;
  const { primary } = p.routes;
  if (!primary) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <span className="flex-1">{t.text(primary.name)} <a href={primary.url} target="_blank" rel="noopener noreferrer" onClick={() => p.onHelp(primary.id)} className="font-medium underline">{t.link}</a></span>
      <button onClick={() => p.onOutcome("dismissed")} aria-label={t.dismiss} className="rounded p-1 hover:bg-amber-100"><X className="h-4 w-4" /></button>
    </div>
  );
}
