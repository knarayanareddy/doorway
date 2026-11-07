import { useMemo, useState } from "react";
import { ChevronDown, Copy, Check, Sprout, Clock } from "lucide-react";
import { isRenderableHours, openStatus } from "@repo/packages/core/src/hours.js";
import { LABELS, footnoteFor, langOf } from "@repo/packages/doorway/src/copy.js";
import { hallwaySections } from "@repo/packages/doorway/src/panels.js";
import { COPY, type Lang } from "../../lib/content";
import type { Route } from "../../lib/routes";
import { ALink, Btn, Tag } from "../ui";

type Block = { type: string; text?: string; items?: string[]; copyLabel?: string; copiedLabel?: string; id?: string; label?: string; onSelect?: () => void };
type Section = { blocks?: Block[]; disclosure?: { label: string; blocks: Block[] } };

/**
 * THE HALLWAY — rehearse the call before making it.
 * The sections (opening hours, first sentences, what the service says about privacy, what to do if you
 * dare not call) come from the real hallwaySections(). A service's privacy wording and its opening
 * hours therefore appear ONLY when isRenderableConfidence / isRenderableHours say the record is
 * verified; by default neither is shown, and "unknown" is never shown as "closed".
 */
export function Hallway({
  lang,
  title,
  sub,
  route,
  selfhelp,
  onHelp,
  onLeave,
}: {
  lang: Lang;
  title: string;
  sub: string;
  route: Route | null;
  selfhelp: Route | null;
  onHelp: (routeId: string) => void;
  onLeave: () => void;
}) {
  const t = COPY[lang].hallway;
  const L = langOf(lang) as Lang;
  const now = useMemo(() => Date.now(), []);
  const sections = useMemo(
    () => hallwaySections({ lang, route, selfhelp, now, onAlt: () => selfhelp && onHelp(selfhelp.id) }) as Section[],
    [lang, route, selfhelp, now, onHelp],
  );
  const status = route && isRenderableHours(route, now) ? openStatus(route.hours, new Date(now)) : null;
  const [open, setOpen] = useState<number | null>(() => {
    const i = sections.findIndex((s) => s.disclosure);
    return i < 0 ? null : i;
  });
  const [copied, setCopied] = useState<string | null>(null);
  const separateSelf = !!selfhelp && selfhelp.id !== route?.id;

  const copy = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
    } catch {
      /* clipboard unavailable — the sentence is still on screen to read aloud */
    }
    setCopied(s);
    setTimeout(() => setCopied(null), 1800);
  };

  const renderBlock = (b: Block, i: number) => {
    switch (b.type) {
      case "text":
        return <p key={i} className="text-sm leading-relaxed text-paper/75">{b.text}</p>;
      case "heading":
        return <p key={i} className="text-sm font-medium text-paper">{b.text}</p>;
      case "phrases":
        return (
          <div key={i} className="space-y-2">
            {b.items?.map((s) => (
              <button
                key={s}
                onClick={() => copy(s)}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-night/60 px-3 py-2.5 text-left text-sm text-paper ring-1 ring-white/10 transition hover:ring-lamp/60"
              >
                <span className="font-display italic">“{s}”</span>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-lamp">
                  {copied === s ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === s ? b.copiedLabel : b.copyLabel}
                </span>
              </button>
            ))}
          </div>
        );
      case "action":
        return selfhelp ? (
          <ALink key={i} variant="soft" href={selfhelp.url} target="_blank" rel="noopener noreferrer" onClick={() => b.onSelect?.()} className="!py-2 text-xs">
            {b.label}
          </ALink>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="dw-rise">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lamp">{t.kicker}</div>
      <h2 className="font-display mt-2 text-2xl font-medium leading-snug text-paper md:text-[28px]">{title}</h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-paper/75">{sub}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
        {/* Left: what the real hallway sections say */}
        <div className="space-y-2">
          {sections.map((s, i) =>
            s.disclosure ? (
              <div key={i} className="rounded-xl bg-white/5 ring-1 ring-white/10">
                <button
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-paper"
                  aria-expanded={open === i}
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  {s.disclosure.label}
                  <ChevronDown className={`h-4 w-4 shrink-0 text-paper/60 transition ${open === i ? "rotate-180" : ""}`} />
                </button>
                {open === i && <div className="space-y-2 px-4 pb-3">{s.disclosure.blocks.map(renderBlock)}</div>}
              </div>
            ) : (
              <div key={i} className="space-y-2 rounded-xl bg-lamp/10 p-4 ring-1 ring-lamp/30">{s.blocks?.map(renderBlock)}</div>
            ),
          )}
        </div>

        {/* Right: where to go */}
        <div className="space-y-3">
          {separateSelf && selfhelp && (
            <ALink
              href={selfhelp.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onHelp(selfhelp.id)}
              variant={status?.open ? "soft" : "lamp"}
              className="w-full !justify-start !py-3.5"
            >
              <Sprout className="h-5 w-5 shrink-0" />
              <span>
                <span className="block">{t.selfhelp}</span>
                <span className="block text-[11px] font-normal opacity-75">{selfhelp.name} · {footnoteFor(selfhelp, L)}</span>
              </span>
            </ALink>
          )}

          {route && (
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-paper/80"><Clock className="h-3.5 w-3.5" /> {route.name}</div>
              {route.phone && <p className="mb-2 text-sm text-paper/85">{route.phone}</p>}
              <ALink href={route.url} target="_blank" rel="noopener noreferrer" onClick={() => onHelp(route.id)} variant={separateSelf && !status?.open ? "soft" : "lamp"} className="w-full !justify-start">
                {LABELS.primary[L]}
              </ALink>
            </div>
          )}

          {route && !route.verifiedAt && <Tag tone="night">route data not yet verified with the service</Tag>}
          <div>
            <Btn variant="ghost" onClick={onLeave} className="!px-2">{t.leave}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
