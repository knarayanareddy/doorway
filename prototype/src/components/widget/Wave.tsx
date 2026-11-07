import { useEffect, useMemo, useRef, useState } from "react";
import { COPY, type Lang } from "../../lib/content";
import { Btn, Tag } from "../ui";
import { ArrowRight, Check } from "lucide-react";

/**
 * THE WAVE — tasteful gamification, with the score removed.
 * Mechanic: a thing to DO (ride a wave, breathe, pick one if–then sentence). No points, no streaks,
 * no badge, no counter of "clean days" — a score is a record, and a record is data about a person.
 * Borrowed from relapse-prevention practice (urge surfing; implementation intentions). Not treatment.
 * Presets only: there is no free text, so nothing a person types can be kept, and the chosen preset
 * lives in sessionStorage only (see store.tsx).
 */

const bell = (x: number) => Math.exp(-Math.pow((x - 0.42) / 0.22, 2) * (x > 0.42 ? 0.8 : 1.15));
const W = 300;
const H = 90;

export function Wave({
  lang,
  fast,
  onTalk,
  onLeave,
  onSavePlan,
  initialPlan,
}: {
  lang: Lang;
  fast: boolean;
  onTalk: () => void;
  onLeave: () => void;
  onSavePlan: (p: string | null) => void;
  initialPlan: string | null;
}) {
  const t = COPY[lang].wave;
  const duration = fast ? 15 : 90;
  const [stage, setStage] = useState<"intro" | "running" | "done" | "planned">("intro");
  const [elapsed, setElapsed] = useState(0);
  const [choice, setChoice] = useState<string>(initialPlan && t.presets.includes(initialPlan) ? initialPlan : "");
  const [kept, setKept] = useState<boolean | null>(null);
  const raf = useRef<number | null>(null);
  const reduced = useMemo(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    if (stage !== "running") return;
    const start = performance.now();
    const tick = (now: number) => {
      const e = (now - start) / 1000;
      if (e >= duration) {
        setElapsed(duration);
        setStage("done");
        return;
      }
      setElapsed(e);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [stage, duration]);

  const p = Math.min(1, elapsed / duration);
  const pts = useMemo(() => Array.from({ length: 61 }, (_, i) => [i / 60, bell(i / 60)] as const), []);
  const toXY = (x: number, y: number) => `${(x * W).toFixed(1)},${(H - 8 - y * (H - 24)).toFixed(1)}`;
  const line = pts.map(([x, y]) => toXY(x, y)).join(" ");
  const done = pts.filter(([x]) => x <= p);
  const area = done.length ? `M${toXY(0, 0)} L${done.map(([x, y]) => toXY(x, y)).join(" L")} L${toXY(done[done.length - 1][0], 0)} Z` : "";
  const dot = toXY(p, bell(p)).split(",").map(Number);
  const phase = p < 0.3 ? t.phases.rise : p < 0.56 ? t.phases.peak : t.phases.fall;
  const breathIn = Math.floor(elapsed / 4) % 2 === 0;
  const scale = reduced ? 1 : 0.8 + 0.34 * (0.5 - 0.5 * Math.cos((Math.PI * elapsed) / 4));
  const remaining = Math.max(0, Math.ceil(duration - elapsed));

  const finishPlan = (keep: boolean) => {
    onSavePlan(keep && choice ? choice : null);
    setKept(keep && !!choice);
    setStage("planned");
  };

  return (
    <div className="dw-rise">
      <Tag tone="night" className="mb-2">{t.reserved}</Tag>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lamp">{t.kicker}</div>
      <h2 className="font-display mt-2 text-2xl font-medium leading-snug text-paper md:text-[28px]">{stage === "done" || stage === "planned" ? t.doneTitle : t.title}</h2>

      {stage === "intro" && (
        <>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-paper/80">{t.body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Btn variant="lamp" onClick={() => setStage("running")}>{t.start} · {duration}s</Btn>
            <Btn variant="ghost" onClick={() => setStage("done")}>{t.skip}</Btn>
          </div>
        </>
      )}

      {stage === "running" && (
        <div className="mt-4" aria-live="polite">
          <div className="flex flex-col items-center gap-4 md:flex-row md:items-center">
            <div className="relative grid h-32 w-32 shrink-0 place-items-center">
              <div className="absolute inset-0 rounded-full bg-lamp/15 blur-xl" />
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-[#f7cf86] to-lamp shadow-[0_0_40px_rgba(232,163,61,0.45)]" style={{ transform: `scale(${scale})` }} />
              <div className="absolute text-xs font-semibold text-night">{breathIn ? t.breathIn : t.breathOut}</div>
            </div>
            <div className="w-full flex-1">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={phase}>
                <polyline points={line} fill="none" stroke="rgba(247,242,232,0.25)" strokeWidth="2" strokeLinecap="round" />
                {area && <path d={area} fill="rgba(232,163,61,0.28)" />}
                <circle cx={dot[0]} cy={dot[1]} r="5.5" fill="#e8a33d" stroke="#0e1a24" strokeWidth="2" />
              </svg>
              <div className="mt-1 flex items-center justify-between text-xs text-paper/70">
                <span className="font-medium text-paper">{phase}</span>
                <span>{t.running(remaining)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Btn variant="ghost" onClick={() => setStage("done")}>{t.skip}</Btn>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="mt-3">
          <p className="max-w-xl text-[15px] leading-relaxed text-paper/80">{t.doneBody}</p>
          <div className="mt-5 rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
            <h3 className="font-display text-lg text-paper">{t.planTitle}</h3>
            <p className="mt-1 text-sm text-lamp">{t.planLead}</p>
            <div className="mt-3 grid gap-2">
              {t.presets.map((x) => (
                <label key={x} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ring-1 transition ${choice === x ? "bg-lamp/15 text-paper ring-lamp" : "bg-white/5 text-paper/80 ring-white/10 hover:bg-white/10"}`}>
                  <input type="radio" name="plan" className="accent-[#e8a33d]" checked={choice === x} onChange={() => setChoice(x)} />
                  {x}
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="lamp" disabled={!choice} onClick={() => finishPlan(true)}>{t.keep}</Btn>
              <Btn variant="soft" onClick={() => finishPlan(false)}>{t.dontKeep}</Btn>
            </div>
          </div>
        </div>
      )}

      {stage === "planned" && (
        <div className="mt-3">
          <p className="flex items-start gap-2 text-sm text-paper/80">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> {kept ? t.kept : t.notKept}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Btn variant="lamp" onClick={onTalk}>{t.next} <ArrowRight className="h-4 w-4" /></Btn>
            <Btn variant="soft" onClick={onLeave}>{t.leave}</Btn>
          </div>
        </div>
      )}

      <p className="mt-5 text-[11px] italic leading-snug text-paper/45">{t.note}</p>
    </div>
  );
}
