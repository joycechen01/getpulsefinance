import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { companyQuery } from "@/lib/edgar-queries";
import { growth, latestWithYoY, series } from "@/lib/metrics";
import { fmtChange, fmtValue } from "@/lib/metric-config";
import { secDocUrl } from "@/lib/format";
import { getChangesPublic } from "@/lib/analysis.functions";
import type { Change } from "@/lib/redline";
import { useReveal } from "@/lib/use-reveal";
import { cn } from "@/lib/utils";

const COMPANIES = [
  { ticker: "NVDA", name: "NVIDIA" },
  { ticker: "CRWD", name: "CrowdStrike" },
  { ticker: "INTC", name: "Intel" },
  { ticker: "TSLA", name: "Tesla" },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Counts up to `target` over 600ms; snaps instantly when reduced motion is on. */
function useCountUp(target: number | null, reduced: boolean) {
  const [shown, setShown] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (target == null || reduced) {
      prev.current = target;
      setShown(target);
      return;
    }
    const from = prev.current ?? 0;
    prev.current = target;
    if (from === target) {
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return shown;
}

function firstSentence(text: string | null, fallback: string | null): string {
  const src = (text ?? fallback ?? "").replace(/\s+/g, " ").trim();
  if (!src) return "";
  const m = src.match(/^.{20,220}?[.!?](?:\s|$)/);
  const s = (m ? m[0] : src.slice(0, 220)).trim();
  return s.length < src.length && !/[.!?]$/.test(s) ? `${s}…` : s;
}

const CHANGE_LABEL: Record<string, string> = { new: "New", expanded: "Expanded", removed: "Removed" };

function WhatChanged({ ticker }: { ticker: string }) {
  const { data } = useQuery({
    queryKey: ["landing-changes", ticker],
    queryFn: () => getChangesPublic({ data: { ticker } }),
    staleTime: 30 * 60 * 1000,
  });
  const reveal = useReveal();
  if (!data?.ok) return null;
  const items = data.changes
    .filter((c: Change) => c.section === "risk_factors" && c.tag !== "reworded")
    .slice(0, 3);
  if (!items.length) return null;
  return (
    <div ref={reveal.ref} className="landing-changed reveal" aria-label="What changed in the latest filing">
      <h3 className="text-base font-medium">What changed in the latest filing</h3>
      <p className="mt-1 text-xs text-muted-foreground">Latest 10-K compared with the prior year</p>
      <ul className="mt-4 space-y-3">
        {items.map((c, i) => (
          <li key={`${c.tag}-${c.pos ?? c.priorPos}`} className="reveal flex items-start gap-3" style={{ transitionDelay: `${i * 100}ms` }}>
            <span className={cn("landing-change-tag", `landing-change-${c.tag}`)}>{CHANGE_LABEL[c.tag]}</span>
            <span className="min-w-0 flex-1 text-sm leading-relaxed">{firstSentence(c.added[0] ?? null, c.text ?? c.priorText)}</span>
            {data.current.url && (
              <a href={data.current.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs">
                Filing <ExternalLink className="size-3" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingResearch() {
  const [ticker, setTicker] = useState("NVDA");
  const [metric, setMetric] = useState<"revenue" | "netIncome">("revenue");
  const reduced = useReducedMotion();
  const result = useQuery(companyQuery(ticker, false));
  const data = result.data?.ok ? result.data : null;
  const rows = data?.financials?.quarterly ?? [];
  const currency = data?.financials?.currency ?? "USD";
  const latest = latestWithYoY(rows, metric);
  const yoy = latest ? growth(latest.value, latest.prior) : null;
  const yoyText = latest ? fmtChange(latest.value, latest.prior, "money") : null;
  const points = series(rows, metric).slice(-12);
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value ?? 0)));
  const hasNegative = points.some((p) => (p.value ?? 0) < 0);
  const baseline = hasNegative ? 90 : 176;
  const chartHeight = hasNegative ? 84 : 170;
  const filing = data?.filings.find((f) => f.form === "10-Q" || f.form === "10-K");
  const source = data
    ? filing
      ? secDocUrl(data.company.cik, filing.accession, filing.primary_document)
      : `https://www.sec.gov/edgar/browse/?CIK=${data.company.cik}`
    : null;
  const commonName = COMPANIES.find((c) => c.ticker === ticker)?.name ?? data?.company.name ?? ticker;
  const counted = useCountUp(latest?.value ?? null, reduced);
  const summaryReveal = useReveal();
  const chartReveal = useReveal(1);

  return (
    <section className="landing-live" aria-label="Company research">
      <h2 className="pb-6">Start with a company.</h2>
      <div className="landing-tabs" role="tablist" aria-label="Research company">
        {COMPANIES.map((c) => (
          <button
            key={c.ticker}
            type="button"
            role="tab"
            aria-selected={ticker === c.ticker}
            onClick={() => setTicker(c.ticker)}
            className="landing-tab"
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="landing-financials">
        <div ref={summaryReveal.ref} className="landing-financial-summary reveal">
          <div className="flex gap-2" role="group" aria-label="Financial metric">
            <Button size="sm" variant={metric === "revenue" ? "default" : "ghost"} aria-pressed={metric === "revenue"} onClick={() => setMetric("revenue")}>
              Revenue
            </Button>
            <Button size="sm" variant={metric === "netIncome" ? "default" : "ghost"} aria-pressed={metric === "netIncome"} onClick={() => setMetric("netIncome")}>
              Net income
            </Button>
          </div>
          {result.isPending ? (
            <div className="mt-6 space-y-3">
              <div className="h-12 w-48 rounded bg-muted" />
              <p className="text-xs text-muted-foreground">Reading SEC financials…</p>
            </div>
          ) : result.isError || !data ? (
            <p className="mt-6 text-sm">Company financials could not be loaded.</p>
          ) : (
            <>
              <p className="landing-financial-value figure mt-6">{fmtValue(counted, "money", currency)}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {latest?.row.label ?? "Not reported"} · {commonName}
              </p>
              {yoy != null && yoyText && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className={cn("figure", yoy >= 0 ? "text-primary" : "text-destructive")}>
                    {yoyText} vs. the same quarter a year earlier
                  </span>
                  <EvidenceBadge kind="calc" />
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <EvidenceBadge kind="fact" />
                {source && (
                  <a href={source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs">
                    SEC source <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </>
          )}
          <Button asChild variant="link" className="mt-6 px-0">
            <Link to="/company/$ticker" params={{ ticker }}>
              Open company research <ArrowRight />
            </Link>
          </Button>
        </div>
        <div ref={chartReveal.ref} className="landing-chart reveal" aria-label={`${commonName} ${metric} quarterly history`}>
          {result.isFetching ? (
            <div className="h-48 animate-pulse rounded bg-muted" />
          ) : (
            <>
              <div className="landing-bars" key={`${ticker}-${metric}`}>
                {points.map((p, i) => (
                  <div key={p.end} className="landing-bar-track">
                    <svg viewBox="0 0 24 180" preserveAspectRatio="none" role="img" aria-label={`${p.label}: ${fmtValue(p.value, "money", currency)}`}>
                      <title>
                        {p.label}: {fmtValue(p.value, "money", currency)}
                      </title>
                      {hasNegative && <line x1="0" x2="24" y1={baseline} y2={baseline} stroke="var(--border)" />}
                      <rect
                        className="landing-bar"
                        style={{ animationDelay: `${i * 30}ms` }}
                        x="3"
                        y={(p.value ?? 0) < 0 ? baseline : baseline - ((p.value ?? 0) / max) * chartHeight}
                        width="18"
                        height={Math.max(0, (Math.abs(p.value ?? 0) / max) * chartHeight)}
                        rx="2"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>{points[0]?.label}</span>
                <span>{points.at(-1)?.label}</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{metric === "revenue" ? "Revenue" : "Net income"} · Last 12 reported quarters</p>
            </>
          )}
        </div>
      </div>
      <WhatChanged ticker={ticker} />
    </section>
  );
}
