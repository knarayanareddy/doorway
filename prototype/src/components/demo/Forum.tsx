import { useState, type ReactNode } from "react";
import { Search, Lock, Train, MessageSquare } from "lucide-react";
import type { Lang } from "../../lib/content";

const THREADS = [
  { t: "Welke locomotief past bij mijn Märklin-baan?", a: "Rob_H0", r: 42, c: "Beginners" },
  { t: "Bouwverslag: station Zwolle in schaal N", a: "NS1700", r: 118, c: "Modelbouw" },
  { t: "Analoog naar digitaal — welke centrale kies je?", a: "SeinwachterJan", r: 67, c: "Techniek" },
  { t: "Wie gaat er naar de beurs in Houten?", a: "treintje_tess", r: 23, c: "Evenementen" },
  { t: "Tips voor realistische ballast en grind", a: "Marjolein_vdB", r: 54, c: "Modelbouw" },
];

const L = {
  nl: { place: "Zoek op het forum…  (probeer: test-trigger-red)", go: "Zoeken", results: "Resultaten voor", none: "Geen resultaten.", latest: "Recente onderwerpen", tag: "20.000 leden · 1 moderator (deeltijd)", held: "Resultaten vastgehouden", heldDecision: "Open decision (docs/11): holding results conflicts with treating the host as an adversary — the host cannot be told whether the person chose to continue without learning that choice." },
  en: { place: "Search the forum…  (try: test-trigger-red)", go: "Search", results: "Results for", none: "No results.", latest: "Latest topics", tag: "20,000 members · 1 part-time moderator", held: "Results held", heldDecision: "Open decision (docs/11): holding results conflicts with treating the host as an adversary — the host cannot be told whether the person chose to continue without learning that choice." },
} as const;

export function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_30px_70px_-35px_rgba(18,32,43,0.55)] ring-1 ring-line">
      <div className="flex items-center gap-3 border-b border-line bg-paper-2 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e6786a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e8c05a]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#7fb58a]" />
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-white px-3 py-1 text-xs text-ink-soft ring-1 ring-line">
          <Lock className="h-3 w-3" /> modelspoor.example / zoeken
        </div>
      </div>
      {children}
    </div>
  );
}

export function ForumHeader({ lang, onSearch }: { lang: Lang; onSearch: (q: string) => void }) {
  const t = L[lang];
  const [q, setQ] = useState("");
  return (
    <header className="border-b border-line bg-gradient-to-b from-[#fff] to-paper px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky text-white"><Train className="h-5 w-5" /></div>
          <div>
            <div className="font-display text-lg font-semibold leading-none text-ink">Modelspoor.nl</div>
            <div className="mt-1 text-[11px] text-ink-soft">{t.tag}</div>
          </div>
        </div>
        <form
          className="ml-auto flex w-full max-w-md flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) onSearch(q.trim());
          }}
        >
          <label className="relative flex-1">
            <span className="sr-only">{t.go}</span>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.place}
              className="w-full rounded-xl bg-white py-2.5 pl-9 pr-3 text-sm text-ink ring-1 ring-line placeholder:text-ink-soft/70 focus:outline-none focus:ring-2 focus:ring-sky"
            />
          </label>
          <button className="rounded-xl bg-sky px-4 py-2.5 text-sm font-medium text-white hover:bg-[#275d78]">{t.go}</button>
        </form>
      </div>
    </header>
  );
}

export function ThreadList({ lang, query, placeholderOnly }: { lang: Lang; query?: string; placeholderOnly?: boolean }) {
  const t = L[lang];
  const list = query && !placeholderOnly ? THREADS.filter((x) => x.t.toLowerCase().includes(query.toLowerCase())) : THREADS;
  return (
    <div className="p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">
        {query ? `${t.results} “${placeholderOnly ? "…" : query}”` : t.latest}
      </div>
      {placeholderOnly ? (
        <ul className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="rounded-xl bg-paper p-3 ring-1 ring-line">
              <div className="h-3.5 w-3/5 rounded bg-ink/15" />
              <div className="mt-2 h-2.5 w-2/5 rounded bg-ink/10" />
            </li>
          ))}
          <li className="pt-1 text-center text-[11px] italic text-ink-soft">Demo: result content is intentionally never rendered.</li>
        </ul>
      ) : list.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.none}</p>
      ) : (
        <ul className="space-y-2">
          {list.map((x) => (
            <li key={x.t} className="flex items-center gap-3 rounded-xl bg-paper p-3 ring-1 ring-line">
              <MessageSquare className="h-4 w-4 shrink-0 text-sky" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{x.t}</div>
                <div className="text-[11px] text-ink-soft">{x.a} · {x.c}</div>
              </div>
              <span className="text-[11px] text-ink-soft">{x.r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HeldResults({ lang }: { lang: Lang }) {
  return (
    <div className="px-5 pb-5">
      <div className="relative" aria-hidden>
        <div className="pointer-events-none select-none blur-[3px] opacity-60">
          <ThreadList lang={lang} query="…" placeholderOnly />
        </div>
        <div className="absolute inset-x-0 top-5 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-medium text-paper"><Lock className="h-3 w-3" /> {L[lang].held}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-ink-soft">{L[lang].heldDecision}</p>
    </div>
  );
}
