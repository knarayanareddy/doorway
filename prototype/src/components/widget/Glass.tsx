import { useState } from "react";
import { EyeOff, HardDrive, ScanEye, Trash2, Check, ShieldCheck } from "lucide-react";
import { FIELDS } from "@repo/packages/core/src/counter.js";
import { GLASS, langOf } from "@repo/packages/doorway/src/copy.js";
import { COPY, type Lang } from "../../lib/content";
import type { Payload } from "../../lib/core";

/**
 * THE GLASS DOOR — the person can audit what the Door sends at the exact moment they have to decide
 * whether to trust it. The field list comes from the real Counter (FIELDS) and every explanation and
 * list from the real copy (GLASS); only the prototype's own notes live in content.ts.
 */
export function Glass({
  lang,
  draft,
  sent,
  n,
  plan,
  legalSynthetic,
  onWipe,
}: {
  lang: Lang;
  draft: Record<string, string | null>;
  sent: Payload | null;
  n: number;
  plan: string | null;
  legalSynthetic: boolean;
  onWipe: () => void;
}) {
  const t = COPY[lang].glassPanel;
  const L = langOf(lang) as Lang;
  const [wiped, setWiped] = useState(false);
  const data: Record<string, string | null> = sent ? { ...sent } : draft;

  return (
    <div className="dw-rise rounded-xl bg-black/30 p-4 text-paper ring-1 ring-white/10" role="region" aria-label={t.title}>
      <div className="flex items-center gap-2 text-lamp">
        <ScanEye className="h-4 w-4" />
        <h3 className="font-display text-base font-medium">{t.title}</h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-paper/70">{GLASS.lead[L]}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-sage">
            <ShieldCheck className="h-3.5 w-3.5" /> {GLASS.leavesHeading[L]}
          </div>
          <div className="rounded-lg bg-black/40 p-3 font-mono text-[11.5px] leading-6" data-testid="glass-fields">
            <span className="text-paper/40">{"{"}</span>
            {FIELDS.map((k: string) => {
              const pending = data[k] == null;
              return (
                <div key={k} className="group pl-3" data-field={k}>
                  <span className="text-lamp">"{k}"</span>
                  <span className="text-paper/40">: </span>
                  <span className={pending ? "italic text-paper/45" : "text-sage"}>{pending ? GLASS.pending[L] : `"${data[k]}"`}</span>
                  <span className="text-paper/40">,</span>
                  <div className="-mt-1 pb-1 font-sans text-[10.5px] leading-snug text-paper/50">↳ {(GLASS.fields as Record<string, Record<Lang, string>>)[k][L]}</div>
                </div>
              );
            })}
            <span className="text-paper/40">{"}"}</span>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-paper/55">{t.protoNote}</p>
          <p className="mt-2 text-[11px] leading-snug text-paper/55">{GLASS.honest[L]}</p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-clay">
              <EyeOff className="h-3.5 w-3.5" /> <span className="text-[#e58f78]">{GLASS.neverHeading[L]}</span>
            </div>
            <ul className="space-y-1 text-xs text-paper/75">
              {[...GLASS.never[L], t.neverExtra].map((x: string) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#e58f78]" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-sky">
              <HardDrive className="h-3.5 w-3.5" /> <span className="text-[#7cc0dd]">{GLASS.localHeading[L]}</span>
            </div>
            <ul className="space-y-1 text-xs text-paper/75">
              <li>• {GLASS.local[L](n)}</li>
              <li>• {t.plan(plan)}</li>
            </ul>
            <button
              onClick={() => {
                onWipe();
                setWiped(true);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-paper ring-1 ring-white/10 transition hover:bg-white/15"
            >
              {wiped ? <Check className="h-3.5 w-3.5 text-sage" /> : <Trash2 className="h-3.5 w-3.5" />}
              {wiped ? GLASS.wiped[L] : GLASS.wipe[L]}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-paper/55">{GLASS.verifyHeading[L]}</div>
        <p className="mt-1.5 text-xs leading-relaxed text-paper/70">{GLASS.verify[L]}</p>
        <p className="mt-2 text-[11px] italic text-paper/45">{legalSynthetic ? t.copySynthetic : t.copyNeutral}</p>
      </div>
    </div>
  );
}
