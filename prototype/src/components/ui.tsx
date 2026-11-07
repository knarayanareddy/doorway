import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn";

type Variant = "lamp" | "ghost" | "soft" | "ink" | "outline";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 text-left";

const variants: Record<Variant, string> = {
  lamp: "bg-lamp text-night hover:bg-[#f0b252] shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_6px_22px_-8px_rgba(232,163,61,0.8)]",
  ghost: "text-paper/80 hover:bg-white/10 hover:text-paper",
  soft: "bg-white/10 text-paper hover:bg-white/15 ring-1 ring-white/10",
  ink: "bg-ink text-paper hover:bg-ink-soft",
  outline: "bg-white text-ink ring-1 ring-line hover:bg-paper-2",
};

export function Btn({ variant = "soft", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={cn(base, variants[variant], className)} />;
}

export function ALink({ variant = "soft", className, ...p }: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant }) {
  return <a {...p} className={cn(base, variants[variant], className)} />;
}

export function Tag({ children, tone = "ink", className }: { children: ReactNode; tone?: "ink" | "lamp" | "sage" | "clay" | "sky" | "night"; className?: string }) {
  const tones = {
    ink: "bg-ink/8 text-ink-soft",
    lamp: "bg-lamp-soft text-lamp-deep",
    sage: "bg-sage-soft text-sage",
    clay: "bg-clay-soft text-clay",
    sky: "bg-sky-soft text-sky",
    night: "bg-white/10 text-paper/80",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

export function DoorLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="5" y="3" width="22" height="26" rx="2.5" fill="#12202b" />
      <path d="M9 7h14v22H9z" fill="#e8a33d" opacity="0.22" />
      <path d="M9 7l9-2.5v24L9 29z" fill="#e8a33d" />
      <circle cx="15.2" cy="17.5" r="1.1" fill="#12202b" />
      <path d="M18 5.5l6 1.8V29h-6z" fill="#fbeccb" opacity="0.85" />
    </svg>
  );
}
