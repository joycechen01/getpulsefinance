import { Link } from "@tanstack/react-router";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";

import { EvidenceBadge } from "@/components/EvidenceBadge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/InfoTip";
import type { Citation, SignalView } from "@/lib/analysis.functions";
import { SECTION_LABEL } from "@/lib/filing-sections";
import { formatDate } from "@/lib/format";
import { CONFIDENCE_TEXT } from "@/lib/glossary";
import { cn } from "@/lib/utils";

const CONF_TONE: Record<string, string> = {
  High: "text-positive border-positive/30",
  Medium: "text-caution border-caution/30",
  Low: "text-muted-foreground border-border",
};

export function CitationItem({ c, label }: { c: Citation; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-md border bg-background/40">
      <Button
        variant="ghost"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-auto w-full flex-wrap items-center justify-start gap-2 whitespace-normal px-3 py-2 text-left text-xs"
      >
        {label && <span className="font-mono text-primary">{label}</span>}
        <span className="font-mono">{c.form}</span>
        <span className="text-muted-foreground">
          {formatDate(c.filing_date)} · {SECTION_LABEL[c.section] ?? c.section}
        </span>
        <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} />
      </Button>
      {!open && c.url && <a href={c.url} target="_blank" rel="noreferrer" className="mx-3 mb-2 inline-flex items-center gap-1 text-xs">SEC source <ExternalLink className="size-3"/></a>}
      {open && (
        <div className="border-t px-3 py-2">
          <p className="text-sm leading-relaxed text-foreground/90">“{c.text}”</p>
          <div className="mt-2 flex items-center justify-between">
            <EvidenceBadge kind="fact" />
            {c.url && (
              <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Open filing on SEC.gov <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function SignalCard({ s, showTicker }: { s: SignalView; showTicker?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        {showTicker && (
          <Link to="/company/$ticker" params={{ ticker: s.ticker }} className="font-mono text-xs text-primary hover:underline">
            {s.ticker}
          </Link>
        )}
        <span className="eyebrow">{s.category}</span>
        {s.filed_date && <span className="text-xs text-muted-foreground">· {formatDate(s.filed_date)}</span>}
        <span className="ml-auto inline-flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase", CONF_TONE[s.confidence])}>
            {s.confidence} confidence
          </span>
          <InfoTip title="Confidence" text={CONFIDENCE_TEXT} />
          <EvidenceBadge kind="ai" compact />
        </span>
      </div>
      <h3 className="mt-2 text-xl leading-snug">{s.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{s.what_happened}</p>
      {open && (
        <dl className="mt-4 space-y-3 text-sm">
          <Row k="What’s new" v={s.whats_new} />
          <Row k="Why it matters" v={s.why_it_matters} />
          <Row k="Historical context" v={s.history} />
          {s.metric_note && (
            <div>
              <dt className="eyebrow mb-1 flex items-center gap-2">
                From the numbers <EvidenceBadge kind="calc" compact />
              </dt>
              <dd>{s.metric_note}</dd>
            </div>
          )}
          <div>
            <dt className="eyebrow mb-1">Evidence</dt>
            <dd>
              <ul className="space-y-2">
                {s.citations.map((c) => (
                  <CitationItem key={c.id} c={c} />
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      )}
      <p className="mt-4 border-t pt-3 text-sm">
        <span className="text-muted-foreground">What remains uncertain: </span>
        {s.uncertain}
      </p>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-3 text-xs text-primary hover:underline">
        {open ? "Show less" : `Show details and ${s.citations.length} source passage${s.citations.length === 1 ? "" : "s"}`}
      </button>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="eyebrow mb-1">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
