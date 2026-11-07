import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Shape } from "./shapes";

export type Tab = "demo" | "desk";

/** The tab is kept in the URL (?tab=live), so a page reload (the Live tab's walk-away) comes back to the same tab. */
const TAB_PARAM: Record<Tab, string> = { demo: "live", desk: "desk" };
function readTab(): Tab {
  const v = new URLSearchParams(window.location.search).get("tab");
  return (Object.keys(TAB_PARAM) as Tab[]).find((t) => TAB_PARAM[t] === v) ?? "demo";
}

interface Ctx {
  exited: boolean;
  quickExit: () => void;
  returnFromExit: () => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  previewRequest: { shape: Shape; nonce: number } | null;
  requestPreview: (s: Shape) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [exited, setExited] = useState(false);
  const [tab, setTabState] = useState<Tab>(readTab);
  const [previewRequest, setPreview] = useState<Ctx["previewRequest"]>(null);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    const u = new URL(window.location.href);
    if (t === "demo") u.searchParams.delete("tab");
    else u.searchParams.set("tab", TAB_PARAM[t]);
    window.history.replaceState(null, "", u);
  }, []);
  const quickExit = useCallback(() => setExited(true), []);
  const returnFromExit = useCallback(() => setExited(false), []);
  const requestPreview = useCallback((shape: Shape) => {
    setTab("demo");
    setPreview({ shape, nonce: Date.now() });
    window.scrollTo({ top: 0 });
  }, [setTab]);

  const value = useMemo<Ctx>(
    () => ({ exited, quickExit, returnFromExit, tab, setTab, previewRequest, requestPreview }),
    [exited, quickExit, returnFromExit, tab, setTab, previewRequest, requestPreview],
  );
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
