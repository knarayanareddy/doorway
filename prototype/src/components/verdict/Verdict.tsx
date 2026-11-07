import type { ReactNode } from "react";
import { ArrowRight, Check, X, ShieldCheck, AlertTriangle, ScanEye, Compass, Waves, DoorOpen, Layers, Footprints, Play } from "lucide-react";
import { useStore } from "../../lib/store";
import type { Shape } from "../../lib/shapes";
import { Btn, Tag } from "../ui";
import { cn } from "../../utils/cn";

/* My judgement at 3fbd10b, not a measured result — stated on screen. */
const SCORE = [
  { c: "Concept", w: 40, now: 7, after: 8.5, why: "Strong thesis, but the surface still reads ‘warning + helpline link’. Agency, post-click drop-off and non-searchers now have a surface." },
  { c: "Prototype", w: 20, now: 3, after: 8, why: "At 3fbd10b the repo had no screens (‘runnable scaffold, not a product’). Here: a working, bilingual front-end that now imports the repo’s real core." },
  { c: "Tech feasibility", w: 15, now: 8, after: 8.5, why: "Privacy-by-construction is the repo’s best asset. The shipped schema added two formats (hallway, door) and no identifying field; Fork and Wave stay reserved. Wave/plan need clinical review." },
  { c: "Product potential", w: 15, now: 6, after: 8, why: "Install story + operator Ladder + study-ready arm make the opportunity legible." },
  { c: "Business feasibility", w: 5, now: 4, after: 6, why: "Free core is right; the paid assurance tier and distribution partners are now explicit — still hypotheses." },
  { c: "Wow / pitch", w: 5, now: 4, after: 8, why: "Static docs don’t pitch. The Glass Door and the five-shape cycle are demonstrable in 90 seconds." },
];
const total = (k: "now" | "after") => SCORE.reduce((a, r) => a + (r[k] * r.w) / 100, 0);

function Section({ id, eyebrow, title, children, tone = "paper" }: { id: string; eyebrow: string; title: string; children: ReactNode; tone?: "paper" | "white" | "night" }) {
  return (
    <section id={id} className={cn("scroll-mt-20 px-4 py-14 lg:px-6", tone === "white" && "bg-white", tone === "night" && "bg-night text-paper")}>
      <div className="mx-auto max-w-5xl">
        <div className={cn("text-xs font-semibold uppercase tracking-[0.2em]", tone === "night" ? "text-lamp" : "text-lamp-deep")}>{eyebrow}</div>
        <h2 className="font-display mt-2 max-w-3xl text-3xl font-medium leading-tight md:text-4xl">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

const NAV = [
  ["q1", "Best possible?"], ["q2", "Sea of sameness"], ["q3", "Pornhub & Google"], ["q4", "Out-of-box moves"], ["q5", "Gamification"], ["diff", "What changed"], ["caveats", "Caveats"], ["pitch", "Pitch"],
];

export function Verdict() {
  const s = useStore();
  const go = (shape: Shape) => s.requestPreview(shape);

  return (
    <div>
      {/* ---------- hero ---------- */}
      <div className="relative overflow-hidden bg-night text-paper">
        <div className="pointer-events-none absolute -right-20 -top-24 h-[420px] w-[420px] rounded-full bg-lamp/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-4 hidden h-64 w-40 2xl:block" aria-hidden>
          <div className="absolute inset-0 rounded-t-[999px] bg-gradient-to-t from-lamp/60 via-lamp/25 to-transparent dw-glow" />
          <div className="absolute inset-x-6 bottom-0 top-8 rounded-t-[999px] border border-lamp/40" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 pb-14 pt-14 lg:px-6">
          <Tag tone="night">Review of knarayanareddy/doorway · for UNICRI × UAE Ministry of Interior</Tag>
          <h1 className="font-display mt-5 max-w-3xl text-5xl font-medium leading-[1.05] md:text-6xl">A door, <span className="text-lamp">not a sign.</span></h1>
          <div className="mt-5 max-w-3xl rounded-xl bg-lamp/15 p-4 text-sm leading-relaxed text-paper ring-1 ring-lamp/40" data-testid="baseline">
            <strong className="text-lamp">Baseline.</strong> This review was written at commit 3fbd10b, before PR #4. Since then PR #4 added the sandboxed-iframe Door, signed routes, the edge, the Desk, and tests across three browsers. This prototype now imports the real core (counter, shift, route, hours, copy) instead of a port. Scores and gap statements below are as of 3fbd10b.
          </div>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper/80">
            Doorway is already the most rigorous thinking I’d expect on this challenge — and still at real risk of being filed under “warning pop-up + helpline link”. This page is the honest review, direct answers to your five questions, and a refactor you can click.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Btn variant="lamp" onClick={() => s.setTab("demo")} className="!px-5 !py-3"><Play className="h-4 w-4" /> Try the live prototype</Btn>
            <Btn variant="soft" onClick={() => document.getElementById("q1")?.scrollIntoView({ behavior: "smooth" })} className="!px-5 !py-3">Read the verdict <ArrowRight className="h-4 w-4" /></Btn>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            <VerdictCard icon={<ShieldCheck className="h-5 w-5 text-sage" />} title="Genuinely strong" items={[
              "Privacy by construction: seven fields, no session, no query text, no redirect through you — enforced by a CI gate.",
              "The Shift: the only design that treats repetition (habituation) as the core problem.",
              "Honest evidence stance: “not proven, and nobody’s is” — and ships the test.",
            ]} />
            <VerdictCard icon={<AlertTriangle className="h-5 w-5 text-lamp" />} title="At risk of sameness" items={[
              "Surface reads as message + link. The best ideas are invisible in a screenshot.",
              "Leads with deterrence; its own dossier says deterrence is unproven beyond minutes.",
              "At 3fbd10b the strongest ideas lived in markdown. PR #4 built the Door; Fork and Wave are still only reserved names there.",
            ]} />
            <VerdictCard icon={<DoorOpen className="h-5 w-5 text-[#7cc0dd]" />} title="What I did about it" items={[
              "Kept the privacy core and the Shift; changed what the Shift does.",
              "Added five things nobody on this track will show (below) and made them clickable.",
              "Cut anything that scores, tracks or shames the person.",
            ]} />
          </div>
        </div>
      </div>

      <div className="sticky top-[57px] z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="no-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2 lg:px-6">
          {NAV.map(([id, l]) => (
            <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }} className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-ink-soft ring-1 ring-line hover:bg-white hover:text-ink">{l}</a>
          ))}
        </div>
      </div>

      {/* ---------- Q1 ---------- */}
      <Section id="q1" eyebrow="Question 1" title="Is the current implementation the best possible?">
        <p className="max-w-3xl text-lg leading-relaxed text-ink-soft">
          <strong className="text-ink">No — and it doesn’t need to be perfect, it needs to be visible.</strong> At 3fbd10b the repo’s own README called itself a “runnable scaffold, not a product”: a pure core and a privacy gate, with no interface built. PR #4 has since added the Door, the edge and the Desk, so the surface gaps below are narrower than when this was written. It would still score well with a juror who reads the 45-minute blueprint. Most won’t. Six gaps mattered at 3fbd10b:
        </p>
        <ol className="mt-6 grid gap-3 md:grid-cols-2">
          {[
            ["The lead mechanism undermines itself", "The dossier cites Ahmia: 3.1 million randomised warnings, no detectable reduction in searching; Google’s −3.8pp is same-session only. Yet the hero is the gate-as-deterrent. The defensible claim is enabling contact, not deterring."],
            ["Nothing happens after the click", "73.9% of people who found a service still didn’t get help (dossier). Doorway hands off with “no redirect, no measurement” — and then stops caring. That drop-off is the biggest unaddressed number in the repo."],
            ["Reach is one door wide", "Only someone who types a trigger gets anything. The tempted-but-not-acted, and the people around them (personas 01 and 04), have no surface. The dossier cites one survey of dark-web searchers (Nurmi et al., 2024) in which about half said their first contact was accidental, and also reports 65.3% first seeing it under 18 — a single “you’re committing a crime” gate misreads both."],
            ["Every shape is a broadcast", "The Shift changes by counter, never by what the person says they need. Nobody is asked anything. Motivational practice is the opposite: offer choices, don’t argue."],
            ["The strongest ideas weren’t visible where it’s judged", "At 3fbd10b the best ideas (Shift, privacy) lived in markdown, and a jury can’t see a state machine; it can see a door open. PR #4 has since built the Door itself; Fork and Wave are still unbuilt there, which is what this prototype shows."],
            ["Adoption has no pull", "The dossier’s own gap doc: voluntary adoption at the long tail has never worked at scale, and there’s no payment rail to lean on. Nothing gives a small operator a reason to install beyond virtue."],
          ].map(([h, b], i) => (
            <li key={h} className="rounded-2xl bg-white p-5 ring-1 ring-line">
              <div className="font-mono text-xs text-lamp-deep">0{i + 1}</div>
              <h3 className="font-display mt-1 text-lg font-medium">{h}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{b}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-line md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-xl font-medium">Against the judging criteria</h3>
            <Tag tone="clay">scored at 3fbd10b · my judgement, not a measured result</Tag>
          </div>
          <div className="mt-4 space-y-3">
            {SCORE.map((r) => (
              <div key={r.c} className="grid items-center gap-2 md:grid-cols-[170px_1fr]">
                <div className="text-sm font-medium">{r.c} <span className="text-xs text-ink-soft">· {r.w}%</span></div>
                <div>
                  <div className="relative h-3 rounded-full bg-paper-2">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-ink/25" style={{ width: `${r.now * 10}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-lamp/90 mix-blend-multiply" style={{ width: `${r.after * 10}%`, opacity: 0.85 }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-ink/60" style={{ width: `${r.now * 10}%` }} />
                  </div>
                  <div className="mt-1 flex items-start justify-between gap-3 text-[11.5px] leading-snug text-ink-soft">
                    <span>{r.why}</span>
                    <span className="shrink-0 font-mono text-ink">{r.now} → {r.after}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-line pt-4">
            <div><div className="text-[11px] uppercase tracking-wider text-ink-soft">Repo at 3fbd10b (weighted)</div><div className="font-display text-3xl">{total("now").toFixed(1)}<span className="text-base text-ink-soft"> / 10</span></div></div>
            <ArrowRight className="h-5 w-5 text-lamp-deep" />
            <div><div className="text-[11px] uppercase tracking-wider text-ink-soft">With this refactor</div><div className="font-display text-3xl text-lamp-deep">{total("after").toFixed(1)}<span className="text-base text-ink-soft"> / 10</span></div></div>
            <p className="max-w-sm text-xs text-ink-soft">Dark bar = the repo at 3fbd10b, amber = after. The biggest movers are Prototype and Wow, because that is where the repo is thinnest — not because the thinking improved by 3×.</p>
          </div>
        </div>
      </Section>

      {/* ---------- Q2 ---------- */}
      <Section id="q2" tone="white" eyebrow="Question 2" title="Why the sea-of-sameness déjà vu?">
        <p className="max-w-3xl text-lg leading-relaxed text-ink-soft">
          Because the sameness isn’t in the engineering — it’s in <strong className="text-ink">five defaults every team on this track shares</strong>. Doorway escapes some of them in the repo, but not in the way it presents. Each one below is a default, and the step off it.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-line">
          <table className="w-full text-sm">
            <thead className="bg-paper-2 text-left text-[11px] uppercase tracking-wider text-ink-soft">
              <tr><th className="p-3">The shared default</th><th className="p-3">The step off it</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                ["The noun is “warning”", "The noun is a door: something you walk through, with five rooms behind it."],
                ["The verb is “deter”", "The verb is “enable contact”. Deterrence is unproven; contact is measurable and is what the 55% who want to stop need."],
                ["The subject is a suspect", "The subject is a person with options: accident, stopping, can’t-stop, worried-about-someone, under-18, here-for-work."],
                ["The privacy claim is a sentence", "The privacy claim is an instrument: the person audits it in the moment (Glass Door)."],
                ["The demo is a screenshot", "The demo is a sequence: five exposures, five shapes, and a dashboard that refuses to show you small numbers."],
              ].map(([a, b]) => (
                <tr key={a}><td className="w-1/2 p-3 text-ink-soft"><X className="mr-1.5 inline h-3.5 w-3.5 text-clay" />{a}</td><td className="p-3 font-medium"><Check className="mr-1.5 inline h-3.5 w-3.5 text-sage" />{b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="font-display mt-10 text-xl font-medium">The sameness test</h3>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">Same problem the person has: the fifth identical warning is invisible. The same is true of the fifth identical pitch a jury hears.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-paper p-4 ring-1 ring-line">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">Five exposures · a banner</div>
            <div className="space-y-1.5">{[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-950"><AlertTriangle className="h-3 w-3" /> A warning about this search. Help is available. <span className="ml-auto font-mono text-amber-700/60">#{i}</span></div>
            ))}</div>
          </div>
          <div className="rounded-2xl bg-night p-4 text-paper">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-paper/50">Five exposures · the Shift</div>
            <div className="space-y-1.5">
              {[
                ["Gate", "What is this?", ScanEye, "bg-white/10"],
                ["Fork", "Where do I stand?", Compass, "bg-lamp/15"],
                ["Wave", "What do I do with this urge?", Waves, "bg-sky/25"],
                ["Hallway", "What happens if I reach out?", Footprints, "bg-sage/25"],
                ["Open door", "Is it still open?", DoorOpen, "bg-lamp/25"],
              ].map(([n, q, Icon, bg], i) => {
                const I = Icon as typeof ScanEye;
                return (
                  <button key={n as string} onClick={() => go(["gate", "fork", "wave", "hallway", "door"][i] as Shape)} className={cn("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11px] transition hover:ring-1 hover:ring-lamp", bg as string)}>
                    <I className="h-3.5 w-3.5 text-lamp" /> <b className="w-16">{n as string}</b> <span className="text-paper/70">“{q as string}”</span><span className="ml-auto font-mono text-paper/40">#{i + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* ---------- Q3 ---------- */}
      <Section id="q3" eyebrow="Question 3" title="Pornhub and Google already tried most of it. What exactly — and where’s the white space?">
        <p className="max-w-3xl text-lg leading-relaxed text-ink-soft">
          You’re right, and it’s worth saying out loud in the pitch: <strong className="text-ink">warning + helpline has been shipped at planetary scale.</strong> Figures below are from the repo’s research dossier. The useful reading isn’t “they failed” — it’s “which questions did their designs never ask?”
        </p>
        <div className="mt-6 overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-paper-2 text-left text-[11px] uppercase tracking-wider text-ink-soft">
              <tr><th className="p-3">Who</th><th className="p-3">What they shipped</th><th className="p-3">What the numbers say</th><th className="p-3">What it never asked</th></tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {[
                ["Pornhub reThink (with Stop It Now)", "Warning + chatbot on flagged searches; whole site still available.", "0.0175% help-click (490 of 2.8M displays).", "Why would anyone click when 2.9M videos are one tap away? Same copy every time."],
                ["Google Search", "Warning box above a working results page.", "0.73% help-click; −3.8pp same-session follow-up queries (DiD) — within-session only.", "What happens after the tab closes? Can the user verify any privacy claim?"],
                ["Project Intercept", "Bespoke, clinician-led interventions per platform.", "~1% help-click; 70M warnings, 22 builds in two years.", "How does it reach a forum with one part-time moderator? (Structural ceiling ≈ one build a month.)"],
                ["Ahmia (Tor search)", "Warnings with no results behind them.", "12.4% help-click — but 3.1M randomised warnings, 140 days, no detectable reduction in searching.", "Can a plug-in recreate ‘no alternatives’? Only partially: by holding results. So test it."],
              ].map((r) => (
                <tr key={r[0]}>{r.map((c, i) => <td key={i} className={cn("p-3 leading-snug", i === 0 ? "font-medium" : "text-ink-soft")}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-soft">The dossier’s own caution: four data points across different populations, messages and destinations. The ordering tracks how many alternatives were on screen — it isn’t proof of cause.</p>

        <h3 className="font-display mt-8 text-xl font-medium">Four gaps nobody on that table occupies</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {[
            ["The long tail", "Everything above needs a giant’s engineers or a consultancy’s clinicians. A free install for the 20,000-member forum is empty ground."],
            ["The ten seconds after the click", "Nobody designs the moment between ‘I clicked’ and ‘I spoke to someone’. That’s where 73.9% are lost."],
            ["Verifiable privacy at the point of decision", "Privacy is usually a sentence. Nobody lets the person check what is sent while deciding whether to trust it."],
            ["A message that changes with the person", "All four serve the same words every time, to everyone, regardless of what the person needs."],
          ].map(([h, b]) => (
            <div key={h} className="rounded-2xl bg-lamp-soft/60 p-4 ring-1 ring-lamp/30">
              <div className="font-display text-base font-medium">{h}</div>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{b}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- Q4 ---------- */}
      <Section id="q4" tone="night" eyebrow="Question 4 · the build" title="Out-of-the-box moves — each one is clickable">
        <p className="max-w-3xl text-lg leading-relaxed text-paper/75">
          Rather than add features, I changed what each <em>exposure</em> is for. Five shapes, each answering a question the person might silently be asking — plus a way to ship the test and a reason for small platforms to adopt.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {([
            ["1", "The Glass Door", "Don’t claim anonymity. Let them audit it.", "A button on every shape opens the exact seven-field object that would leave the browser, a crossed-out list of what never will, what stays local (with a wipe button), and how to verify it in DevTools. The 70% who can’t find an anonymous route need evidence, not reassurance.", ScanEye, "gate" as Shape, "See it on the Gate → ‘What does this send?’"],
            ["2", "The Fork", "Ask, don’t accuse.", "“Which sentence is closest to true right now?” Six honest answers — by accident · want to stop · can’t stop · worried about someone · under 18 · here for work — each leads somewhere different. The choice is sent nowhere (no classifier, no query text). Reserved: not in the shipped sequence.", Compass, "fork" as Shape, "Try each of the six answers"],
            ["3", "The Wave", "A skill, not a scare.", "An interactive urge-surfing exercise (90 s; 15 s in demo) followed by one preset if–then sentence, kept only until the tab closes. Gamification with the score removed: something to do with breath and hands. Reserved: clinical review pending.", Waves, "wave" as Shape, "Ride the wave"],
            ["4", "The Hallway", "Rehearse the call before making it.", "Addresses the fear of the unknown up front, hands over a first sentence to copy, states a service’s privacy terms only when someone at the service has confirmed them, and shows open or closed only for verified hours. Designed for the 73.9% lost after the click, and for a service that handles ~2.6 contacts a day.", Footprints, "hallway" as Shape, "Walk the hallway"],
            ["5", "The Open Door", "Presence, not pressure.", "By exposure five the threat has failed four times. The form stops pushing: a slim, non-blocking card with one big action and a rotating, non-judgemental line. The door stays open; the person decides.", DoorOpen, "door" as Shape, "Preview the fifth shape"],
          ] as const).map(([n, h, tag, b, Icon, shape, cta]) => (
            <article key={n} className="flex flex-col rounded-2xl bg-night-2 p-5 ring-1 ring-white/10">
              <div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-lamp/15 text-lamp"><Icon className="h-5 w-5" /></div><span className="font-mono text-xs text-paper/40">0{n}</span></div>
              <h3 className="font-display mt-4 text-xl font-medium">{h}</h3>
              <div className="mt-0.5 text-sm font-medium text-lamp">{tag}</div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-paper/70">{b}</p>
              <Btn variant="soft" className="mt-4 w-full !justify-between" onClick={() => go(shape)}>{cta} <ArrowRight className="h-4 w-4" /></Btn>
            </article>
          ))}
          <article className="flex flex-col rounded-2xl bg-lamp p-5 text-night">
            <div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-night/10"><Layers className="h-5 w-5" /></div><span className="font-mono text-xs text-night/50">06</span></div>
            <h3 className="font-display mt-4 text-xl font-medium">Ladder + study-ready</h3>
            <div className="mt-0.5 text-sm font-semibold">Ship the test. Gamify the adopter.</div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-night/80">Five checkable criteria earn a public badge for operators; an install-level control arm lets platforms run gate-vs-banner without ever randomising a person; a dashboard that suppresses cells under 10 — and says what it can’t tell you.</p>
            <Btn variant="ink" className="mt-4 w-full !justify-between" onClick={() => s.setTab("desk")}>Open The Desk <ArrowRight className="h-4 w-4" /></Btn>
          </article>
        </div>
        <div className="mt-8 rounded-2xl bg-white/5 p-5 text-sm leading-relaxed text-paper/75 ring-1 ring-white/10">
          <strong className="text-paper">Also added, quietly:</strong> a Quick exit on every shape (and Esc ×2) · a false-alarm path for parents, researchers and moderators — the appeals loop the repo’s own gap doc says nobody has · an under-18 path · an “other people” path for partners and family · NL and EN, language-first routing · and a banner control arm that shows what everyone else ships.
        </div>
      </Section>

      {/* ---------- Q5 ---------- */}
      <Section id="q5" eyebrow="Question 5" title="Would tasteful gamification make sense?">
        <p className="max-w-3xl text-lg leading-relaxed text-ink-soft">
          <strong className="text-ink">Yes — but never aimed at the person at risk.</strong> The usual toolkit (points, badges, streaks, leaderboards) fails three tests here. Gamification is welcome where it creates agency, or where it moves the people with the power to adopt.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-clay-soft/50 p-5 ring-1 ring-clay/25">
            <div className="flex items-center gap-2 font-display text-lg font-medium text-clay"><X className="h-5 w-5" /> Refused, and why</div>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
              <li><b className="text-ink">Streaks / “days clean”.</b> A streak turns a slip into a failure state. And a counter is a record — data about a person — which breaks the repo’s own rule R1.</li>
              <li><b className="text-ink">Points, badges, levels for the person.</b> The dossier ties help-seeking to guilt and shame. Scorekeeping adds judgement to the exact place it already hurts.</li>
              <li><b className="text-ink">Leaderboards or social features.</b> Obvious, but worth writing down.</li>
              <li><b className="text-ink">Free-text AI chat on the person’s words.</b> Their words are content; content is evidence.</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-sage-soft/60 p-5 ring-1 ring-sage/25">
            <div className="flex items-center gap-2 font-display text-lg font-medium text-sage"><Check className="h-5 w-5" /> Allowed, and where</div>
            <ul className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
              <li><b className="text-ink">Mechanics of agency</b> — choice (the Fork), pacing and a thing to do (the Wave), a sentence you write for yourself (if–then plan). No score, nothing recorded.</li>
              <li><b className="text-ink">Real game mechanics on the system</b> — the operator Ladder: criteria-based levels, a public badge, nobody ranked against anybody. It targets the real blocker: adoption.</li>
              <li><b className="text-ink">Play for the jury</b> — the five-exposure cycle is a game you play in the demo; the Desk’s k-suppression meters unlock as you act.</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-line">
          <div className="text-sm font-semibold">The test I applied to every mechanic</div>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">Would it still be okay if the person is a 15-year-old, a survivor, or a parent who mistyped? Does it create a record? Could it make someone feel scored for a bad day? If any answer is wrong, it’s out.</p>
        </div>
      </Section>

      {/* ---------- diff ---------- */}
      <Section id="diff" tone="white" eyebrow="The refactor" title="What I kept, changed, added and cut">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Kept", "sage", ["Seven-field whitelist; no session, query, timestamp, exact count", "k ≥ 10 suppression; numerators over denominators", "Pure, network-free pick() with widening windows (10 min → 6 h → 72 h)", "Language-first routing; links go direct with ?src=doorway", "Honest demo baselines (0.5–1.5%), not the organiser tool’s 15%", "Only fake test-trigger-* terms (SAFETY rule 1)"]],
            ["Changed", "sky", ["Shift: three forms by count → five shapes in the demo, each answering a question (the shipped sequence is gate, card, hallway, hallway, door)", "Results held on the early shapes, a slim card at 5+", "Copy: warmer ‘je’ voice; accident is named as possible; legal wording only from a reviewed record, neutral by default", "Counter enum: +2 formats (hallway, door) replace chat; fork and wave stay reserved and are rejected by the edge", "Quiet line still exists inside the re-warning window"]],
            ["Added", "lamp", ["Glass Door (audit panel on every shape)", "Fork with six honest paths; false-alarm and under-18 paths", "Wave + local if–then plan with wipe", "Hallway: first sentences, verified-only privacy and hours, a self-help alternative", "Quick exit + Esc ×2; banner control arm; operator Ladder + badge", "Live k-suppression meters on The Desk"]],
            ["Cut / refused", "clay", ["Anything that scores, streaks or ranks a person", "Free-text AI on a person’s words", "Any server-side storage of plans or choices", "Email/phone capture of any kind", "Claims of deterrence"]],
          ].map(([h, tone, items]) => (
            <div key={h as string} className="rounded-2xl bg-paper p-5 ring-1 ring-line">
              <Tag tone={tone as "sage"}>{h as string}</Tag>
              <ul className="mt-3 space-y-1.5 text-sm leading-snug text-ink-soft">
                {(items as string[]).map((i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-soft" />{i}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- caveats ---------- */}
      <Section id="caveats" eyebrow="Straight talk" title="What this is not, and what must be verified">
        <p className="max-w-3xl text-ink-soft">The repo’s best trait is honesty about its limits. A refactor that buried that would be a regression, so here is the same standard applied to this build.</p>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["Front-end only", "The Shift, Counter, route and copy logic are imported from the repo’s real packages; only Fork and Wave are prototype-only. Nothing is sent over a network. This UI has its own Playwright spec; the repo’s suites cover the core."],
            ["Facts are borrowed, not verified", "No legal or confidentiality claim shows by default: they render only from reviewed records (docs/04 V1), and none is reviewed yet. The route data comes from the repo’s signed bundle. A youth-service route is not in it, so the under-18 path offers no link until one is verified."],
            ["The Wave is a skill, not a treatment", "Urge-surfing and implementation intentions come from addiction and relapse-prevention practice. There is no evidence here that they work for this population. They need clinician review with the prevention-field experts before any pilot — and the copy says ‘not treatment’."],
            ["The Desk numbers are synthetic", "Chosen from the dossier’s honest range. They illustrate how suppression bites on a small forum; they are not evidence."],
            ["Capacity is a hard limit", "Offlimits handles roughly 2.6 contacts a day. Success could break it. The Hallway offers self-help alongside, and when verified hours say the line is closed — a formal capacity contract with each service is still needed."],
            ["Open risks remain", "False positives; displacement to other platforms; whether a held result is a rock or a nudge. That last one is exactly what the control arm is for."],
          ].map(([h, b]) => (
            <li key={h} className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <div className="text-sm font-semibold">{h}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{b}</p>
            </li>
          ))}
        </ul>
        <div className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-line">
          <h3 className="font-display text-lg font-medium">Who pays (hypotheses — 5% of the score, so keep it short)</h3>
          <ul className="mt-2 grid gap-2 text-sm leading-relaxed text-ink-soft md:grid-cols-3">
            <li><b className="text-ink">Free open core</b> for platforms; funded by the public/NGO side (UNICRI hub, Safer Internet Centres, EU programmes).</li>
            <li><b className="text-ink">Paid assurance tier</b> for mid-size platforms and hosters: signed trigger packs, audit, a DPIA pack, an SLA — things a trust-and-safety lead must show a regulator.</li>
            <li><b className="text-ink">Distribution through hosters</b> and trust-and-safety networks, where the long tail already buys services — not through convincing 20,000 forums one by one.</li>
          </ul>
        </div>
      </Section>

      {/* ---------- pitch ---------- */}
      <Section id="pitch" tone="night" eyebrow="The pitch" title="Everyone built a better sign. We built a door — and made the wall glass.">
        <ol className="grid gap-3 md:grid-cols-2">
          {[
            ["0:00", "The line", "“Everyone on this track built a better sign. We built a door.” Name the déjà vu yourself, before the jury does."],
            ["0:20", "Fire → Gate", "Type test-trigger-red. Results held; the accident is allowed; the plain fact about the material, with no legal claim."],
            ["0:45", "Open the Glass Door", "“Here are the seven fields. Nothing else. Check the network tab.” This is your wow moment."],
            ["1:10", "Fork → Wave", "Fire again; choose “I want to stop but I’m not sure I can”. Ride the wave. Write one sentence."],
            ["1:50", "Hallway", "“73.9% are lost after the click. When verified hours say the line is closed, we offer self-help instead of a phone that doesn’t ring.”"],
            ["2:20", "The Desk", "Ladder, badge, suppression meters, banner-vs-gate arm. “We ship the test with the product.”"],
            ["2:50", "Close", "“Not proven, and nobody’s is.” End on what you refused to build."],
          ].map(([t, h, b]) => (
            <li key={t} className="flex gap-4 rounded-2xl bg-night-2 p-4 ring-1 ring-white/10">
              <div className="font-mono text-sm text-lamp">{t}</div>
              <div><div className="font-display text-base font-medium">{h}</div><p className="mt-0.5 text-sm leading-relaxed text-paper/70">{b}</p></div>
            </li>
          ))}
        </ol>
        <div className="mt-8"><Btn variant="lamp" className="!px-5 !py-3" onClick={() => s.setTab("demo")}><Play className="h-4 w-4" /> Start the demo</Btn></div>
      </Section>
    </div>
  );
}

function VerdictCard({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="flex items-center gap-2 font-display text-lg">{icon} {title}</div>
      <ul className="mt-2 space-y-2 text-[13px] leading-snug text-paper/70">
        {items.map((i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-lamp" />{i}</li>)}
      </ul>
    </div>
  );
}
