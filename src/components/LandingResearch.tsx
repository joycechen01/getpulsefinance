import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { companyQuery } from "@/lib/edgar-queries";
import { latestWithYoY, series } from "@/lib/metrics";
import { fmtValue } from "@/lib/metric-config";
import { secDocUrl } from "@/lib/format";

const COMPANIES = [ {ticker:"NVDA",name:"NVIDIA"}, {ticker:"CRWD",name:"CrowdStrike"}, {ticker:"INTC",name:"Intel"}, {ticker:"TSLA",name:"Tesla"} ];

export function LandingResearch() {
  const [ticker,setTicker] = useState("NVDA");
  const [metric,setMetric] = useState<"revenue"|"netIncome">("revenue");
  const result = useQuery(companyQuery(ticker,false));
  const data = result.data?.ok ? result.data : null;
  const rows = data?.financials?.quarterly ?? [];
  const currency = data?.financials?.currency ?? "USD";
  const latest = latestWithYoY(rows,metric);
  const points = series(rows,metric).slice(-12);
  const max = Math.max(1,...points.map(p=>Math.abs(p.value??0)));
  const filing = data?.filings.find(f=>f.form==="10-Q"||f.form==="10-K");
  const source = data ? filing ? secDocUrl(data.company.cik,filing.accession,filing.primary_document) : `https://www.sec.gov/edgar/browse/?CIK=${data.company.cik}` : null;
  return <section className="landing-live" aria-label="Company research">
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div><p className="mb-2 text-xs text-primary">The story behind the ticker</p><h2>Start with a company.</h2></div>
      <span className="text-xs text-muted-foreground">SEC filings · Quarterly financials</span>
    </div>
    <div className="landing-company-selector" role="group" aria-label="Research company">
      {COMPANIES.map(c=><Button key={c.ticker} variant="ghost" aria-pressed={ticker===c.ticker} onClick={()=>setTicker(c.ticker)} className="landing-company-option"><span className="figure text-xs">{c.ticker}</span><span>{c.name}</span><ArrowRight className="ml-auto"/></Button>)}
    </div>
    <div className="landing-financials">
      <div className="landing-financial-summary">
        <div className="flex gap-2" role="group" aria-label="Financial metric"><Button size="sm" variant={metric==="revenue"?"default":"ghost"} aria-pressed={metric==="revenue"} onClick={()=>setMetric("revenue")}>Revenue</Button><Button size="sm" variant={metric==="netIncome"?"default":"ghost"} aria-pressed={metric==="netIncome"} onClick={()=>setMetric("netIncome")}>Net income</Button></div>
        {result.isPending ? <div className="mt-6 space-y-3"><div className="h-12 w-48 rounded bg-muted"/><p className="text-xs text-muted-foreground">Reading SEC financials…</p></div> : result.isError || !data ? <p className="mt-6 text-sm">Company financials could not be loaded.</p> : <><p className="landing-financial-value figure mt-6">{fmtValue(latest?.value,"money",currency)}</p><p className="mt-2 text-sm text-muted-foreground">{latest?.row.label ?? "Not reported"} · {data.company.name}</p><div className="mt-4 flex flex-wrap items-center gap-3"><EvidenceBadge kind="fact"/>{source&&<a href={source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs">SEC source <ExternalLink className="size-3"/></a>}</div></>}
        <Button asChild variant="link" className="mt-6 px-0"><Link to="/company/$ticker" params={{ticker}}>Open company research <ArrowRight/></Link></Button>
      </div>
      <div className="landing-chart" aria-label={`${ticker} ${metric} quarterly history`}>
        {result.isFetching ? <div className="h-48 animate-pulse rounded bg-muted"/> : <><div className="landing-bars">{points.map(p=><div key={p.end} className="landing-bar-track"><svg viewBox="0 0 24 180" preserveAspectRatio="none" role="img" aria-label={`${p.label}: ${fmtValue(p.value,"money",currency)}`}><title>{p.label}: {fmtValue(p.value,"money",currency)}</title><rect x="3" y={p.value!=null && p.value<0?146:146-((p.value??0)/max)*140} width="18" height={Math.max(0,Math.abs(p.value??0)/max*140)} rx="2" fill="currentColor"/></svg></div>)}</div><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{points[0]?.label}</span><span>{points.at(-1)?.label}</span></div><p className="mt-3 text-xs text-muted-foreground">{metric==="revenue"?"Revenue":"Net income"} · Last 12 reported quarters</p></>}
      </div>
    </div>
  </section>;
}