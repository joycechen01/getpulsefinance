import { useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { Button } from "@/components/ui/button";
import { signalsQuery } from "@/lib/edgar-queries";
import { series, type Financials } from "@/lib/metrics";
import { formatDate, formatRatio } from "@/lib/format";
import { CitationItem } from "./SignalCard";

export function StoryTimeline({ticker,fin,sourceUrl}:{ticker:string;fin:Financials|null;sourceUrl:string}) {
  const signals=useQuery(signalsQuery(ticker));
  const [selected,setSelected]=useState<string|null>(null);
  const points=fin?series(fin.quarterly,"operatingMargin").slice(-20):[];
  const chart=points.filter(p=>p.value!=null).map(p=>({...p,time:Date.parse(p.end)}));
  const entries=signals.data?.ok?signals.data.signals:[];
  const active=entries.find(s=>s.id===selected);
  const dates=chart.map(p=>p.time);
  return <section className="space-y-6">
    <div>
      <h2>Company story timeline</h2>
      <p className="mt-1 text-xs text-muted-foreground">Operating margin · quarterly · {chart.length?`${formatDate(chart[0]?.end)} – ${formatDate(chart[chart.length-1]?.end)}`:"Not reported"}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3"><EvidenceBadge kind="calc"/><a href={sourceUrl} target="_blank" rel="noreferrer" className="text-xs">SEC financial statements</a></div>
    </div>
    {chart.length ? <ClientOnly fallback={<div className="h-64 rounded bg-muted"/>}>
      <div className="h-64 min-w-0" aria-label="Operating margin history">
        <ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{top:16,right:16,left:0,bottom:8}}>
          <CartesianGrid vertical={false} stroke="var(--color-rule)"/>
          <XAxis dataKey="time" type="number" domain={[Math.min(...dates),Math.max(...dates, ...entries.flatMap(s=>s.citations.map(c=>Date.parse(c.filing_date))))]} scale="time" tickFormatter={v=>String(new Date(v).getUTCFullYear())} tick={{fill:"var(--color-muted-foreground)",fontSize:12}}/>
          <YAxis tickFormatter={v=>formatRatio(Number(v))} tick={{fill:"var(--color-muted-foreground)",fontSize:12}} width={60}/>
          <Tooltip labelFormatter={v=>formatDate(new Date(Number(v)).toISOString().slice(0,10))} formatter={v=>[formatRatio(Number(v)),"Operating margin"]}/>
          <Line dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} isAnimationActive={false}/>
          {entries.flatMap(s=>{
            const cite=s.citations.slice().sort((a,b)=>a.filing_date.localeCompare(b.filing_date))[0];
            if(!cite)return [];
            return [<ReferenceLine key={s.id} x={Date.parse(cite.filing_date)} stroke="var(--color-chart-4)" strokeDasharray="3 4" label={<TimelinePin title={s.title} onSelect={()=>setSelected(s.id)}/>}/>];
          })}
        </LineChart></ResponsiveContainer>
      </div>
    </ClientOnly>:<p className="text-sm text-muted-foreground">No operating margin history reported.</p>}
    <p className="text-xs text-muted-foreground">{chart.length<12?"Less than three years of reported margin data is available. ":""}Signal marks use the earliest source filing in the reviewed evidence; earlier filings may contain prior disclosures.</p>
    {signals.isLoading?<div className="space-y-2"><div className="h-24 rounded bg-muted"/><p className="text-sm text-muted-foreground">Reading filing signals…</p></div>:signals.data && !signals.data.ok?<p className="text-sm">{signals.data.error}</p>:!entries.length?<p className="text-sm text-muted-foreground">No detected signals in the filings reviewed.</p>:<ol className="divide-y border-y">
      {entries.map(s=><li key={s.id} className="py-3"><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={()=>setSelected(s.id)}><span className="text-caution">◆</span><span className="min-w-0"><span className="block text-xs text-muted-foreground">{formatDate(s.citations.slice().sort((a,b)=>a.filing_date.localeCompare(b.filing_date))[0]?.filing_date)}</span>{s.title}</span></Button></li>)}
    </ol>}
    {active&&<div className="border-l-2 border-teal pl-4"><div className="flex items-center justify-between gap-3"><h3>{active.title}</h3><EvidenceBadge kind="ai"/></div><p className="mt-2 text-sm">{active.what_happened}</p><ul className="mt-4 space-y-2">{active.citations.map(c=><CitationItem key={`${active.id}-${c.id}`} c={c} defaultOpen/>)}</ul><p className="mt-3 text-sm text-muted-foreground">What remains uncertain: {active.uncertain}</p></div>}
  </section>;
}

function TimelinePin({viewBox,title,onSelect}:{viewBox?:{x?:number;y?:number};title:string;onSelect:()=>void}) {
  if(viewBox?.x==null||viewBox.y==null)return null;
  return <foreignObject x={viewBox.x-14} y={viewBox.y} width={28} height={32}><Button variant="ghost" size="icon" className="size-7 text-chart-4" aria-label={`Open signal: ${title}`} title={title} onClick={onSelect}>◆</Button></foreignObject>;
}