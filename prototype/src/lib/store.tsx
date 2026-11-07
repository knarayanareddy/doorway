import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Tab = "demo" | "desk";

/** The tab is kept in the URL (?tab=live), so a page reload (the Live tab's walk-away) comes back to the same tab. */
const TAB_PARAM: Record<Tab, string> = { demo: "live", desk: "desk" };
function readTab(): Tab {
  const v = new URLSearchParams(window.location.search).get("tab");
  return (Object.keys(TAB_PARAM) as Tab[]).find((t) => TAB_PARAM[t] === v) ?? "demo";
}

interface Ctx {
  tab: Tab;
  setTab: (t: Tab) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>(readTab);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    const u = new URL(window.location.href);
    if (t === "demo") u.searchParams.delete("tab");
    else u.searchParams.set("tab", TAB_PARAM[t]);
    window.history.replaceState(null, "", u);
  }, []);
  const value = useMemo<Ctx>(() => ({ tab, setTab }), [tab, setTab]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
