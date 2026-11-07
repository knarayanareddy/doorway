import { useState } from "react";
import { Radio } from "lucide-react";
import { DoorLogo, Tag } from "../ui";
import { cn } from "../../utils/cn";
import { LiveDesk } from "./LiveDesk";
import { SyntheticDesk } from "./SyntheticDesk";

type Mode = "live" | "synthetic";

const MODES: { id: Mode; label: string }[] = [
  { id: "live", label: "Live demo install" },
  { id: "synthetic", label: "Synthetic 20,000-member forum" },
];

/**
 * The Desk. Live mode reads the real Door's aggregates through /__desk/agg on this origin (default).
 * Synthetic mode is the local, invented view of a 20,000-member forum, labelled SYNTHETIC.
 */
export function Desk() {
  const [mode, setMode] = useState<Mode>("live");
  const synthetic = mode === "synthetic";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-night"><DoorLogo className="h-6 w-6" /></div>
        <div>
          <h1 className="font-display text-2xl font-medium">The Desk</h1>
          <p className="text-sm text-ink-soft">Operator view · Modelspoor.nl · {synthetic ? <span className="font-mono text-xs">inst_demo001 (invented numbers)</span> : <span>reads the Door&apos;s aggregates</span>}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {synthetic ? <Tag tone="clay">SYNTHETIC — not from any Door</Tag> : <Tag tone="sage"><Radio className="h-3 w-3" /> live from the Door</Tag>}
        </div>
      </div>

      <div role="group" aria-label="Data source" className="inline-flex flex-wrap gap-1 rounded-xl bg-paper-2 p-1 ring-1 ring-line">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              mode === m.id ? "bg-ink text-paper shadow" : "text-ink-soft hover:text-ink",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {synthetic ? <SyntheticDesk /> : <LiveDesk />}
    </div>
  );
}
