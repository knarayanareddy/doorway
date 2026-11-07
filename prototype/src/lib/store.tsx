import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "./content";
import { advance, build, markActed, type LocalState, type Payload } from "./core";
import { EXTRA_FORMATS, type Shape } from "./shapes";

export type Tab = "verdict" | "demo" | "desk";

export interface Settings {
  lang: Lang;
  arm: "doorway" | "banner";
  realistic: boolean;
  fastWave: boolean;
  ladder: boolean[];
}

const DEFAULT_SETTINGS: Settings = { lang: "nl", arm: "doorway", realistic: false, fastWave: true, ladder: [true, true, true, false, false] };
const EMPTY_LOCAL: LocalState = { n: 0, last: 0, seen: [] };

const K_SETTINGS = "doorway.demo.settings";
const K_LOCAL = "doorway.local.v3";
const K_EVENTS = "doorway.demo.events";
/** Earlier builds kept a free-text plan in here; it is removed on load. */
const K_LEGACY_LOCAL = "doorway.local.v2";
/** The Wave plan is a preset sentence, kept in sessionStorage only: gone when the tab closes. */
const K_PLAN = "doorway.demo.plan";

let storageBlocked = false;
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    storageBlocked = true;
    return fallback;
  }
}
function readEvents(): Payload[] {
  try {
    const raw = localStorage.getItem(K_EVENTS);
    const list = raw ? (JSON.parse(raw) as Record<string, unknown>[]) : [];
    return list.filter((e) => build(e, { extraFormats: EXTRA_FORMATS }).ok) as unknown as Payload[];
  } catch {
    storageBlocked = true;
    return [];
  }
}
function readPlan(): string | null {
  try {
    return sessionStorage.getItem(K_PLAN);
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    storageBlocked = true;
  }
}

interface Ctx {
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  /** Not persisted: the preview always starts OFF. */
  synthetic: boolean;
  setSynthetic: (on: boolean) => void;
  local: LocalState;
  advanceLocal: (variant: string, keepClock?: boolean) => void;
  actedLocal: () => void;
  plan: string | null;
  savePlan: (plan: string | null) => void;
  wipeLocal: () => void;
  events: Payload[];
  emit: (raw: Record<string, unknown>) => Payload | null;
  clearEvents: () => void;
  exited: boolean;
  quickExit: () => void;
  returnFromExit: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  previewRequest: { shape: Shape; nonce: number } | null;
  requestPreview: (s: Shape) => void;
  storageBlocked: boolean;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setS] = useState<Settings>(() => read(K_SETTINGS, DEFAULT_SETTINGS));
  const [synthetic, setSynthetic] = useState(false);
  const [local, setLocal] = useState<LocalState>(() => {
    try {
      localStorage.removeItem(K_LEGACY_LOCAL);
    } catch {
      /* nothing to remove */
    }
    return read(K_LOCAL, EMPTY_LOCAL);
  });
  const [plan, setPlan] = useState<string | null>(readPlan);
  const [events, setEvents] = useState<Payload[]>(readEvents);
  const [exited, setExited] = useState(false);
  const [tab, setTab] = useState<Tab>("verdict");
  const [previewRequest, setPreview] = useState<Ctx["previewRequest"]>(null);

  useEffect(() => write(K_SETTINGS, settings), [settings]);
  useEffect(() => write(K_LOCAL, local), [local]);
  useEffect(() => write(K_EVENTS, events.slice(-800)), [events]);

  const setSettings = useCallback((p: Partial<Settings>) => setS((s) => ({ ...s, ...p })), []);
  const advanceLocal = useCallback((variant: string, keepClock = false) => setLocal((l) => advance(l, variant, Date.now(), { keepClock })), []);
  const actedLocal = useCallback(() => setLocal((l) => markActed(l, Date.now())), []);
  const savePlan = useCallback((p: string | null) => {
    setPlan(p);
    try {
      if (p) sessionStorage.setItem(K_PLAN, p);
      else sessionStorage.removeItem(K_PLAN);
    } catch {
      /* session storage unavailable: the plan lives in memory only */
    }
  }, []);
  const wipeLocal = useCallback(() => {
    setLocal(EMPTY_LOCAL);
    setPlan(null);
    try {
      localStorage.removeItem(K_LOCAL);
      sessionStorage.removeItem(K_PLAN);
    } catch {
      /* nothing to wipe */
    }
  }, []);

  const emit = useCallback((raw: Record<string, unknown>) => {
    const res = build(raw, { extraFormats: EXTRA_FORMATS });
    if (!res.ok) {
      console.warn("Counter rejected payload:", res.errors);
      return null;
    }
    setEvents((e) => [...e, res.payload as Payload]);
    return res.payload as Payload;
  }, []);
  const clearEvents = useCallback(() => setEvents([]), []);

  const quickExit = useCallback(() => setExited(true), []);
  const returnFromExit = useCallback(() => setExited(false), []);
  const requestPreview = useCallback((shape: Shape) => {
    setTab("demo");
    setPreview({ shape, nonce: Date.now() });
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      settings, setSettings, synthetic, setSynthetic, local, advanceLocal, actedLocal, plan, savePlan, wipeLocal, events, emit, clearEvents,
      exited, quickExit, returnFromExit, tab, setTab, previewRequest, requestPreview, storageBlocked,
    }),
    [settings, setSettings, synthetic, local, advanceLocal, actedLocal, plan, savePlan, wipeLocal, events, emit, clearEvents, exited, quickExit, returnFromExit, tab, previewRequest, requestPreview],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
