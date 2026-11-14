import { cn } from "@/lib/utils";
import { BADGES } from "@/lib/glossary";

import { InfoTip } from "./InfoTip";

const TONE = {
  fact: "text-badge-fact border-badge-fact/30 bg-badge-fact/10",
  calc: "text-badge-calc border-badge-calc/30 bg-badge-calc/10",
  ai: "text-badge-ai border-badge-ai/30 bg-badge-ai/10",
  market: "text-badge-market border-badge-market/30 bg-badge-market/10",
} as const;

export function EvidenceBadge({ kind, compact }: { kind: keyof typeof BADGES; compact?: boolean }) {
  const b = BADGES[kind];
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "rounded-sm border px-1.5 py-px font-mono text-[10px] tracking-wide uppercase",
          TONE[kind],
        )}
      >
        {compact ? b.label.split(" ")[0] : b.label}
      </span>
      <InfoTip title={b.label} text={b.text} />
    </span>
  );
}
