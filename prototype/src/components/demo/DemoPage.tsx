import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Zap, Eye, Info, CheckCircle2, ArrowRight, RotateCcw, Lock } from "lucide-react";
import { BrowserFrame, ForumHeader, HeldResults, ThreadList, forumLang } from "./Forum";
import { INSTALL, loadDoorway, type DoorwayStatus } from "./doorwayLoader";
import { useStore } from "../../lib/store";
import type { Shape } from "../../lib/shapes";
import { Btn, Tag } from "../ui";
import { cn } from "../../utils/cn";

/** The five presses, in the order the real Door escalates through them (labs: fork and wave on). */
const ORDER = ["gate", "fork", "wave", "hallway", "door"] as const;
const STEP_LABEL: Record<(typeof ORDER)[number], string> = { gate: "Gate", fork: "Fork", wave: "Wave", hallway: "Hallway", door: "Door" };
/** Every shape the Door's preview lab accepts (packages/doorway/src/labs.js). Nothing else. */
const PREVIEWS: [Shape, string][] = [
  ["gate", "Gate"],
  ["card", "Card"],
  ["fork", "Fork"],
  ["wave", "Wave"],
  ["hallway", "Hallway"],
  ["door", "Door"],
  ["quiet", "Quiet line"],
];

const TRIGGER = "test-trigger-";
const NOT_LOADED = "The real Door is not loaded on this page. Run npm run demo:app and open http://127.0.0.1:8789/app/.";

/** Presses so far, kept for this tab session only so leaving and coming back to the tab does not lose the timeline. */
const COUNT_KEY = "doorway.demo.presses";
function readCount(): number {
  try {
    const n = Number.parseInt(sessionStorage.getItem(COUNT_KEY) ?? "", 10);
    return Number.isFinite(n) && n > 0 && n < 100000 ? n : 0;
  } catch {
    return 0;
  }
}
function writeCount(n: number) {
  try {
    sessionStorage.setItem(COUNT_KEY, String(n));
  } catch {
    /* storage blocked: the count lasts for this page only */
  }
}

let consumedPreview: number | null = null;

export function DemoPage() {
  const s = useStore();
  const [lang] = useState(forumLang);
  const [status, setStatus] = useState<DoorwayStatus>("loading");
  const [count, setCount] = useState(readCount);
  const [wasReset, setWasReset] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [searched, setSearched] = useState<string | null>(null);
  const countRef = useRef(count);
  const lastPromise = useRef<Promise<void> | null>(null);
  const ready = status === "ready";

  useEffect(() => {
    let live = true;
    loadDoorway().then((ok) => {
      if (live) setStatus(ok ? "ready" : "missing");
    });
    return () => {
      live = false;
    };
  }, []);

  /**
   * One press. The loader returns the open overlay's own promise while a Door is up: that press is ignored and
   * not counted. A preview forces a shape and never moves the timeline.
   */
  const open = useCallback(
    (preview?: Shape) => {
      const dw = window.doorway;
      if (!dw) {
        setNote(NOT_LOADED);
        return;
      }
      const p = dw.trigger("search", preview ? { preview } : {});
      if (p === lastPromise.current) {
        setNote("The Door is already open. This press was not counted.");
        return;
      }
      lastPromise.current = p;
      setDoorOpen(true);
      setSearched(null);

      if (preview) {
        setNote(`Preview: the Door shows the ${PREVIEWS.find(([s]) => s === preview)?.[1] ?? preview} shape. This timeline does not move.`);
        void p.then(() => setDoorOpen(false));
        return;
      }

      const next = countRef.current + 1;
      countRef.current = next;
      setCount(next);
      writeCount(next);
      setNote(null);
      void p.then(() => setDoorOpen(false));
    },
    [],
  );

  // Preview requests (store.requestPreview): open that shape once the loader is ready. Nothing calls requestPreview
  // at present: the Review page that sent them has been removed. Each request is consumed once per page, so coming
  // back to this tab later does not open it again.
  useEffect(() => {
    if (ready && s.previewRequest && s.previewRequest.nonce !== consumedPreview) {
      consumedPreview = s.previewRequest.nonce;
      open(s.previewRequest.shape);
    }
  }, [ready, s.previewRequest, open]);

  const onSearch = (q: string) => {
    // The PLATFORM decides a search is a trigger. Doorway only hears the kind ("search"), never the text.
    if (q.toLowerCase().startsWith(TRIGGER)) open();
    else setSearched(q);
  };

  const startAgain = () => {
    countRef.current = 0;
    setCount(0);
    writeCount(0);
    setWasReset(true);
    setNote("This timeline is back at 0. The Door still remembers this browser: open a private window to see the first step again.");
  };

  const nextText = wasReset && count === 0 ? "Next: wherever this browser's Door has got to. Use a private window for a clean start." : count >= ORDER.length ? "Next: Door. It stays on the Door from here." : `Next: ${STEP_LABEL[ORDER[count]]}`;
  const nextLabel = count < ORDER.length && !(wasReset && count === 0) ? STEP_LABEL[ORDER[count]] : null;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_330px] lg:px-6">
      {/* ------------ the mock platform ------------ */}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <Tag tone="sky">Mock platform</Tag>
          <span>
            A Dutch hobby forum. The forum decides a search is a trigger and calls{" "}
            <code className="rounded bg-ink/8 px-1 font-mono text-[11px]">window.doorway.trigger(&quot;search&quot;)</code> — it never passes the text.
          </span>
        </div>
        <BrowserFrame>
          <ForumHeader lang={lang} onSearch={onSearch} />
          <div className="min-h-[420px] bg-white">
            {doorOpen && <HeldResults lang={lang} />}
            {!doorOpen && note && (
              <div role="status" className="dw-rise m-4 flex items-center gap-2 rounded-xl bg-sage-soft px-4 py-3 text-sm text-ink ring-1 ring-sage/30">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-sage" /> {note}
              </div>
            )}
            {!doorOpen && <ThreadList lang={lang} query={searched ?? undefined} />}
          </div>
        </BrowserFrame>

        {/* what this page learns from the Door, and where the counts go */}
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft">What this page is told</div>
            <Btn variant="outline" className="!px-3 !py-1.5 text-xs" onClick={() => s.setTab("desk")}>
              Open The Desk <ArrowRight className="h-3.5 w-3.5" />
            </Btn>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Only that the Door settled. Not what the person chose. The Door sends its seven-field record to the edge on its own origin, not to this page;
            The Desk shows what the edge counted.
          </p>
        </div>
      </div>

      {/* ------------ demo controls (not part of the forum) ------------ */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl bg-night p-4 text-paper shadow-lg">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-lamp">
            <Zap className="h-3.5 w-3.5" /> Demo controls
          </div>

          {status === "missing" && (
            <div role="alert" className="mt-3 rounded-xl bg-clay-soft p-3 text-xs leading-relaxed text-clay ring-1 ring-clay/30">
              The real Door is not running here, so nothing can be fired. Run <code className="font-mono">npm run demo:app</code> in the repository, then open{" "}
              <code className="font-mono">http://127.0.0.1:8789/app/</code>. Nothing is faked.
            </div>
          )}

          <Btn variant="lamp" className="mt-3 w-full !justify-center !py-3" onClick={() => open()} disabled={!ready}>
            {status === "loading" ? "Loading the Door…" : "Fire a trigger"}
            {nextLabel && <span className="text-xs opacity-70">→ {nextLabel}</span>}
          </Btn>
          <p className="mt-2 text-[11px] leading-snug text-paper/55">
            …or type <code className="rounded bg-white/10 px-1 font-mono">test-trigger-red</code> in the forum search. Only fake <code className="font-mono">test-trigger-*</code> terms
            exist in this build (SAFETY rule 1).
          </p>

          {/* the Shift timeline: follows the presses this page counted */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-paper/60">
              <span>The Shift · presses this page counted</span>
              <span className="font-mono text-paper" data-testid="press-count">{count}</span>
            </div>
            <ol className="grid grid-cols-5 gap-1.5" aria-label="The five shapes, in order">
              {ORDER.map((sh, i) => {
                const done = count >= i + 1;
                const upNext = count === i;
                return (
                  <li
                    key={sh}
                    data-step={i + 1}
                    data-reached={done ? "true" : undefined}
                    aria-current={count > 0 && count === i + 1 ? "step" : undefined}
                    className={cn(
                      "rounded-lg px-1 py-2 text-center text-[10.5px] font-medium ring-1",
                      upNext ? "bg-lamp text-night ring-lamp" : done ? "bg-white/15 text-paper ring-white/20" : "bg-white/5 text-paper/60 ring-white/10",
                    )}
                  >
                    <div className="font-mono text-[9px] opacity-70">{i + 1}{i === ORDER.length - 1 ? "+" : ""}</div>
                    {STEP_LABEL[sh]}
                  </li>
                );
              })}
            </ol>
            <p role="status" aria-live="polite" className="mt-2 text-[11px] leading-snug text-paper/70">
              {nextText}
            </p>
            {note && doorOpen && <p role="status" className="mt-1 text-[11px] leading-snug text-lamp">{note}</p>}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[11px] leading-snug text-paper/55">Demo mode: every press shows the next step. The real product also escalates by how the last exposure ended; that is switched off here so you can show all five in a row.</p>
            <Btn variant="ghost" className="!px-2.5 !py-1.5 text-xs" onClick={startAgain}>
              <RotateCcw className="h-3.5 w-3.5" /> Start the timeline again
            </Btn>
          </div>

          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="mb-1.5 text-[11px] text-paper/60">Preview a shape · does not count</div>
            <div className="flex flex-wrap gap-1.5">
              {PREVIEWS.map(([sh, label]) => (
                <Btn key={sh} variant="soft" className="!px-2.5 !py-1.5 text-xs" onClick={() => open(sh)} disabled={!ready}>
                  <Eye className="h-3.5 w-3.5" /> {label}
                </Btn>
              ))}
            </div>
          </div>

          <p className="mt-4 flex gap-2 text-[11px] leading-snug text-paper/60">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              The Door keeps its own memory of this browser, on its own origin. This page cannot read or clear it. Only you can, with “Wis wat dit apparaat onthoudt” on a
              Door card, or by opening the app in a private window. A browser that has already seen the Door can start further along than this timeline.
            </span>
          </p>
        </div>

        <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="text-xs font-semibold text-ink">Settings, as the script tag sets them</div>
          <p className="text-[11px] leading-snug text-ink-soft">
            Read-only here. Change them in the script tag, not in this page.
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] text-ink-soft">
            <Row k="Install" v={INSTALL.install} />
            <Row k="Country" v={INSTALL.country} />
            <Row k="Legal jurisdiction" v={INSTALL.legalJurisdiction} />
            <Row k="Shapes switched on" v={INSTALL.labs} />
            <Row k="Wave length" v={`${INSTALL.waveSeconds} s`} />
            <Row k="Language" v="Follows the browser (nl, en or de). No switch exists." />
            <Row k="Loader" v={status === "ready" ? "Loaded from /dist/latest" : status === "loading" ? "Loading…" : "Not available"} />
          </dl>
        </div>

        <div className="flex gap-2 rounded-2xl bg-lamp-soft p-3 text-xs leading-relaxed text-lamp-deep ring-1 ring-lamp/30">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The Door, the loader, the Shift and the edge are the repo&apos;s own code, served from this origin and the Door origin. Nothing in this page re-implements the Door.
          </span>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <dt className="font-medium text-ink">{k}</dt>
      <dd className="font-mono">{v}</dd>
    </>
  );
}
