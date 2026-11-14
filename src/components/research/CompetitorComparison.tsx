import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getNamedCompetitors,getComparison,type ComparisonResult } from "@/lib/research.functions";
import { COMPARISON_METRICS, MAX_COMPETITORS, selectAllPeers, type ComparisonMetric } from "@/lib/research";
import { formatDate,formatRatio } from "@/lib/format";
import { CitationItem } from "./SignalCard";

export function CompetitorComparison({ticker}:{ticker:string}) {
  const q=useQuery({queryKey:["named-competitors",ticker],queryFn:()=>getNamedCompetitors({data:{ticker}}),staleTime:30*60*1000,retry:false});
  const compare=useServerFn(getComparison);
  const [selected,setSelected]=useState<string[]>([]);
  const [result,setResult]=useState<ComparisonResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [hidden,setHidden]=useState<string[]>([]);
  const peers=q.data?.ok?q.data.competitors:[];
  const rows=result?.ok?result.rows:[];
  const matched=peers.filter(p=>p.registrant);
  return <section className="space-y-6">
    <div><h2>Competitor comparison</h2><p className="mt-1 text-xs text-muted-foreground">Named in the latest annual filing{q.data?.ok?` · ${formatDate(q.data.filingDate)}`:""}</p></div>
    {q.isLoading?<div className="space-y-2"><div className="h-32 rounded bg-muted"/><p className="text-sm text-muted-foreground">Reading competition and risk disclosures…</p></div>:!q.data?.ok?<p className="text-sm">{q.data?.error??"Could not read competitors."}</p>:!peers.length?<p className="text-sm text-muted-foreground">No named competitors were found in the competition and risk passages reviewed.</p>:<>
      <details className="border-y py-3" open={!result}><summary className="cursor-pointer text-sm">Select filing-named competitors</summary>
        <div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={()=>setSelected(selectAllPeers(matched.map(p=>p.name)))}>Select all</Button><Button size="sm" variant="ghost" disabled={!selected.length} onClick={()=>setSelected([])}>Clear</Button>{matched.length>MAX_COMPETITORS&&<span className="text-xs text-muted-foreground">{matched.length} named; up to {MAX_COMPETITORS} can be compared, so Select all picks the first {MAX_COMPETITORS} in filing order.</span>}</div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{matched.map(p=><li key={p.name} className="rounded-md border bg-surface p-3"><label className="flex items-start gap-2 text-sm"><Checkbox className="mt-0.5" checked={selected.includes(p.name)} disabled={!selected.includes(p.name)&&selected.length>=MAX_COMPETITORS} onCheckedChange={v=>setSelected(prev=>v?[...prev,p.name]:prev.filter(n=>n!==p.name))}/><span className="min-w-0 flex-1"><span className="block truncate font-medium" title={p.name}>{p.name}</span><span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">{p.registrant?.ticker}<EvidenceBadge kind="fact" compact/></span></span></label><details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">Source</summary><ul className="mt-2 space-y-2">{p.citations.map(c=><CitationItem key={c.id} c={c}/>)}</ul>{p.note&&<p className="mt-2 text-xs text-muted-foreground"><EvidenceBadge kind="ai"/> {p.note}</p>}</details></li>)}</ul></details>
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{setResult(await compare({data:{ticker,peers:selected}}));}catch{setResult({ok:false,error:"The comparison could not be loaded. Please try again."});}finally{setBusy(false);}}}>{busy?"Reading SEC financials…":"Compare selected companies"}</Button><span className="text-xs text-muted-foreground">{selected.length} of 5 competitors selected</span></div>
      {peers.some(p=>!p.registrant)&&<details><summary className="cursor-pointer text-sm">Named, no comparable SEC data</summary><ul className="mt-3 space-y-4">{peers.filter(p=>!p.registrant).map(p=><li key={p.name}><div className="flex flex-wrap gap-2 text-sm">{p.name}<EvidenceBadge kind="fact" compact/></div><ul className="mt-2 space-y-2">{p.citations.map(c=><CitationItem key={c.id} c={c}/>)}</ul></li>)}</ul></details>}
    </>}
    {busy&&<div className="h-32 rounded bg-muted"/>}
    {result&&!result.ok&&<p className="text-sm">{result.error}</p>}
    {!!rows.length&&<>
      <div className="overflow-x-auto rounded-md border bg-surface"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left"><th className="p-3">Company / TTM period</th>{COMPARISON_METRICS.map(m=><th key={m.id} className="p-3 text-right"><span className="inline-flex items-center gap-1">{m.label}<InfoTip term={m.term} title={m.label}/></span></th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.cik} className={i===0?"border-b bg-accent":"border-b"}><td className="p-3"><div>{r.ticker} · {r.name}</div><div className="mt-1 text-xs text-muted-foreground">{r.end?`${formatDate(r.start)} – ${formatDate(r.end)}`:"No complete TTM data"}</div><div className="mt-2 flex gap-2"><EvidenceBadge kind="calc" compact/>{r.url&&<a href={r.url} target="_blank" rel="noreferrer" className="text-xs">SEC source</a>}</div></td>{COMPARISON_METRICS.map(m=><td key={m.id} className="figure p-3 text-right">{r.values[m.id]==null?"Not reported":formatRatio(r.values[m.id])}</td>)}</tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">Trends show rolling four-quarter values. Fiscal calendars differ, so each point is placed on the calendar quarter in which that company's period ended. Missing quarters are left as gaps, never estimated.</p>
      {COMPARISON_METRICS.map(m=><TrendChart key={m.id} metric={m.id} label={m.label} term={m.term} rows={rows} hidden={hidden} toggle={t=>setHidden(h=>h.includes(t)?h.filter(x=>x!==t):[...h,t])}/>)}
      <p className="text-xs text-muted-foreground">Whole-company trailing twelve-month figures; differing period ends are shown above. Company size and business mix may differ from the competing product line. No investment ranking is implied.</p>
    </>}
  </section>;
}

const COLORS=["var(--color-chart-1)","var(--color-chart-2)","var(--color-chart-3)","var(--color-chart-4)","var(--color-chart-5)","var(--color-muted-foreground)"];
type Row=Extract<ComparisonResult,{ok:true}>["rows"][number];
function TrendChart({metric,label,term,rows,hidden,toggle}:{metric:ComparisonMetric;label:string;term:(typeof COMPARISON_METRICS)[number]["term"];rows:Row[];hidden:string[];toggle:(t:string)=>void}){
  const quarters=[...new Set(rows.flatMap(r=>r.trend.map(p=>p.quarter)))].sort().slice(-12);
  const data=quarters.map(q=>{const o:Record<string,string|number|null>={quarter:q};for(const r of rows){const p=r.trend.find(x=>x.quarter===q);o[r.ticker]=p?.values[metric]??null;o[`${r.ticker}__end`]=p?.end??null;}return o;});
  const any=rows.some(r=>r.trend.some(p=>p.values[metric]!=null));
  return <section className="space-y-2 border-t pt-4"><h3 className="flex items-center gap-1 font-display">{label}<InfoTip term={term} title={label}/></h3>
    {!any?<p className="text-sm text-muted-foreground">Not reported for the selected companies.</p>:
    <ClientOnly fallback={<div className="h-64 rounded bg-muted"/>}><div className="h-64 overflow-hidden"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:8,right:12,left:0,bottom:0}}>
      <CartesianGrid vertical={false} stroke="var(--color-rule)"/>
      <XAxis dataKey="quarter" tick={{fill:"var(--color-muted-foreground)",fontSize:11}} minTickGap={16}/>
      <YAxis tickFormatter={v=>formatRatio(Number(v))} width={64} tick={{fill:"var(--color-muted-foreground)",fontSize:11}}/>
      <Tooltip formatter={(v,name,item)=>{const end=(item?.payload as Record<string,unknown>|undefined)?.[`${String(name)}__end`];return [`${formatRatio(Number(v))}${end?` · period ended ${formatDate(String(end))}`:""}`,String(name)];}}/>
      <Legend onClick={e=>toggle(String(e.dataKey))} wrapperStyle={{fontSize:12,cursor:"pointer"}}/>
      {rows.map((r,i)=><Line key={r.cik} dataKey={r.ticker} name={r.ticker} hide={hidden.includes(r.ticker)} stroke={COLORS[i%COLORS.length]} strokeWidth={i===0?3:1.5} strokeOpacity={i===0?1:0.75} dot={{r:i===0?3:2}} connectNulls={false} isAnimationActive={false}/>)}
    </LineChart></ResponsiveContainer></div></ClientOnly>}
  </section>;
}
