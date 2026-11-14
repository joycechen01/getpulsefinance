import { FileText, Calculator, Sparkles, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { BADGES } from "@/lib/glossary";

import { InfoTip } from "./InfoTip";

const TONE = {
  fact: "text-badge-fact border-transparent bg-badge-fact-bg",
  calc: "text-badge-calc border-transparent bg-badge-calc-bg",
  ai: "text-badge-ai border-transparent bg-badge-ai-bg",
  market: "text-badge-market border-transparent bg-badge-market-bg",
} as const;

export function EvidenceBadge({ kind, compact }: { kind: keyof typeof BADGES; compact?: boolean }) {
  const b = BADGES[kind];
  const Icon = { fact: FileText, calc: Calculator, ai: Sparkles, market: Globe }[kind];
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-[4px] border px-2 py-1 font-sans text-xs",
          TONE[kind],
        )}
      >
        <Icon className="size-3" aria-hidden />
        {compact ? b.label.split(" ")[0] : b.label}
      </span>
      <InfoTip title={b.label} text={b.text} />
    </span>
  );
}
