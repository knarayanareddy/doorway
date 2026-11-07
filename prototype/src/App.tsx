import { MonitorPlay, LayoutDashboard } from "lucide-react";
import { StoreProvider, useStore, type Tab } from "./lib/store";
import { DoorLogo } from "./components/ui";
import { DemoPage } from "./components/demo/DemoPage";
import { Desk } from "./components/desk/Desk";
import { cn } from "./utils/cn";

const TABS: { id: Tab; label: string; icon: typeof MonitorPlay }[] = [
  { id: "demo", label: "Live prototype", icon: MonitorPlay },
  { id: "desk", label: "The Desk", icon: LayoutDashboard },
];

function Shell() {
  const { tab, setTab } = useStore();

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5 lg:px-6">
          <button onClick={() => setTab("demo")} className="flex items-center gap-2.5">
            <DoorLogo className="h-8 w-8" />
            <div className="text-left leading-tight">
              <div className="font-display text-lg font-semibold">Doorway <span className="text-lamp-deep">v2</span></div>
              <div className="hidden text-[11px] text-ink-soft sm:block">Stop Before It Starts · UNICRI challenge · Hackathon for Good #8</div>
            </div>
          </button>
          <nav className="ml-auto flex gap-1 rounded-xl bg-paper-2 p-1 ring-1 ring-line" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  window.scrollTo({ top: 0 });
                }}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  tab === t.id ? "bg-ink text-paper shadow" : "text-ink-soft hover:text-ink",
                )}
              >
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(" ")[0]}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main>
        {tab === "demo" && <DemoPage />}
        {tab === "desk" && <Desk />}
      </main>
      <footer className="mx-auto max-w-7xl px-4 py-8 text-xs leading-relaxed text-ink-soft lg:px-6">
        Prototype for Hackathon for Good #8. Demo data only: the Live tab’s counts come from presses on the demo install, and the synthetic Desk view is invented. No real search terms exist anywhere in this build. No legal or confidentiality claim is shown unless it comes from a reviewed record (docs/04 V1). Every legal record in this build is an unreviewed draft, so the Door shows neutral copy.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
