import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { Button } from "@/components/ui/button";
import { signalsQuery } from "@/lib/edgar-queries";
import { formatDate } from "@/lib/format";
import { CitationItem } from "./SignalCard";

export function StoryTimeline({ ticker }: { ticker: string }) {
  const signals = useQuery(signalsQuery(ticker));
  const [selected, setSelected] = useState<string | null>(null);
  const entries = (signals.data?.ok ? signals.data.signals : [])
    .map((signal) => ({ signal, source: signal.citations.slice().sort((a, b) => a.filing_date.localeCompare(b.filing_date))[0] }))
    .sort((a, b) => (b.source?.filing_date ?? "").localeCompare(a.source?.filing_date ?? ""));

  return (
    <section className="space-y-6">
      <div>
        <h2>Company story timeline</h2>
        <p className="mt-2 text-xs text-muted-foreground">Dates reflect the earliest source filing in the reviewed evidence, not necessarily the first disclosure.</p>
      </div>
      {signals.isLoading ? (
        <div className="space-y-2"><div className="h-24 animate-pulse rounded bg-muted" /><p className="text-sm text-muted-foreground">Reading filing signals…</p></div>
      ) : signals.error ? (
        <div className="space-y-2"><p className="text-sm">Couldn’t load the company timeline.</p><Button variant="outline" size="sm" onClick={() => signals.refetch()}>Try again</Button></div>
      ) : signals.data && !signals.data.ok ? (
        <p className="text-sm">{signals.data.error}</p>
      ) : !entries.length ? (
        <p className="text-sm text-muted-foreground">No detected developments in the filings reviewed.</p>
      ) : (
        <ol className="ml-2 border-l border-border">
          {entries.map(({ signal: s, source }) => {
            const open = selected === s.id;
            return (
              <li key={s.id} className="relative pb-8 pl-6 last:pb-0 sm:pl-8">
                <span aria-hidden="true" className="absolute -left-1.5 top-1.5 size-3 rounded-full border-2 border-background bg-primary" />
                <article className="space-y-3 border-b pb-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <time dateTime={source?.filing_date} className="font-mono text-xs text-muted-foreground">{source ? formatDate(source.filing_date) : "Date not reported"}</time>
                    <EvidenceBadge kind="ai" compact />
                    {source?.url && <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">SEC source <ExternalLink className="size-3" /></a>}
                  </div>
                  <h3 className="text-xl leading-snug">{s.title}</h3>
                  <p className="max-w-3xl text-sm leading-relaxed">{s.what_happened}</p>
                  <Button variant="ghost" size="sm" aria-expanded={open} aria-controls={`story-${s.id}`} className="h-auto whitespace-normal px-0 text-primary" onClick={() => setSelected(open ? null : s.id)}>
                    {open ? "Hide evidence" : "View evidence"}<ChevronDown className={`size-4 ${open ? "rotate-180" : ""}`} />
                  </Button>
                  {open && <div id={`story-${s.id}`} className="space-y-4"><ul className="space-y-2">{s.citations.map((c) => <CitationItem key={`${s.id}-${c.id}`} c={c} defaultOpen />)}</ul><p className="text-sm text-muted-foreground">What remains uncertain: {s.uncertain}</p></div>}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}