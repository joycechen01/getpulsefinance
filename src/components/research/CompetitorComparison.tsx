import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { InfoTip } from "@/components/InfoTip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { getNamedCompetitors,getComparison,type ComparisonResult } from "@/lib/research.functions";
import { COMPARISON_METRICS, type ComparisonMetric } from "@/lib/research";
import { formatDate,formatRatio } from "@/lib/format";
import { CitationItem } from "./SignalCard";

export function CompetitorComparison({ticker}:{ticker:string}) {
  const q=useQuery({queryKey:["named-competitors",ticker],queryFn:()=>getNamedCompetitors({data:{ticker}}),staleTime:30*60*1000,retry:false});
  const compare=useServerFn(getComparison);
  const [selected,setSelected]=useState<string[]>([]);
  const [result,setResult]=useState<ComparisonResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [metric,setMetric]=useState<ComparisonMetric>("operatingMargin");
  const peers=q.data?.ok?q.data.competitors:[];
  const rows=result?.ok?result.rows:[];
  return <section className="space-y-6">
    <div><h2>Competitor comparison</h2><p className="mt-1 text-xs text-muted-foreground">Named in the latest annual filing{q.data?.ok?` · ${formatDate(q.data.filingDate)}`:""}</p></div>
    {q.isLoading?<div className="space-y-2"><div className="h-32 rounded bg-muted"/><p className="text-sm text-muted-foreground">Reading competition and risk disclosures…</p></div>:!q.data?.ok?<p className="text-sm">{q.data?.error??"Could not read competitors."}</p>:!peers.length?<p className="text-sm text-muted-foreground">No named competitors were found in the competition and risk passages reviewed.</p>:<>
      <details className="border-y py-3" open={!result}><summary className="cursor-pointer text-sm">Select filing-named competitors</summary><ul className="divide-y">{peers.filter(p=>p.registrant).map(p=><li key={p.name} className="py-4"><label className="flex flex-wrap items-center gap-3 text-sm"><Checkbox checked={selected.includes(p.name)} disabled={!selected.includes(p.name)&&selected.length>=5} onCheckedChange={v=>setSelected(prev=>v?[...prev,p.name]:prev.filter(n=>n!==p.name))}/>{p.name}<span className="text-xs text-muted-foreground">{p.registrant?.ticker}</span><EvidenceBadge kind="fact" compact/></label><ul className="mt-2 space-y-2">{p.citations.map(c=><CitationItem key={c.id} c={c}/>)}</ul>{p.note&&<p className="mt-2 text-sm text-muted-foreground"><EvidenceBadge kind="ai"/> {p.note}</p>}</li>)}</ul></details>
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{setResult(await compare({data:{ticker,peers:selected}}));}catch{setResult({ok:false,error:"The comparison could not be loaded. Please try again."});}finally{setBusy(false);}}}>{busy?"Reading SEC financials…":"Compare selected companies"}</Button><span className="text-xs text-muted-foreground">{selected.length} of 5 competitors selected</span></div>
      {peers.some(p=>!p.registrant)&&<details><summary className="cursor-pointer text-sm">Named, no comparable SEC data</summary><ul className="mt-3 space-y-4">{peers.filter(p=>!p.registrant).map(p=><li key={p.name}><div className="flex flex-wrap gap-2 text-sm">{p.name}<EvidenceBadge kind="fact" compact/></div><ul className="mt-2 space-y-2">{p.citations.map(c=><CitationItem key={c.id} c={c}/>)}</ul></li>)}</ul></details>}
    </>}
    {busy&&<div className="h-32 rounded bg-muted"/>}
    {result&&!result.ok&&<p className="text-sm">{result.error}</p>}
    {!!rows.length&&<>
      <div className="overflow-x-auto rounded-md border bg-surface"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left"><th className="p-3">Company / TTM period</th>{COMPARISON_METRICS.map(m=><th key={m.id} className="p-3 text-right"><span className="inline-flex items-center gap-1">{m.label}<InfoTip term={m.term} title={m.label}/></span></th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.cik} className={i===0?"border-b bg-accent":"border-b"}><td className="p-3"><div>{r.ticker} · {r.name}</div><div className="mt-1 text-xs text-muted-foreground">{r.end?`${formatDate(r.start)} – ${formatDate(r.end)}`:"No complete TTM data"}</div><div className="mt-2 flex gap-2"><EvidenceBadge kind="calc" compact/>{r.url&&<a href={r.url} target="_blank" rel="noreferrer" className="text-xs">SEC source</a>}</div></td>{COMPARISON_METRICS.map(m=><td key={m.id} className="figure p-3 text-right">{r.values[m.id]==null?"Not reported":formatRatio(r.values[m.id])}</td>)}</tr>)}</tbody></table></div>
      <div className="flex flex-wrap items-center gap-4"><h3 className="font-display">{COMPARISON_METRICS.find(m=>m.id===metric)?.label}</h3><Select value={metric} onValueChange={v=>{const m=COMPARISON_METRICS.find(m=>m.id===v);if(m)setMetric(m.id);}}><SelectTrigger className="w-56"><SelectValue/></SelectTrigger><SelectContent>{COMPARISON_METRICS.map(m=><SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent></Select></div>
      <ClientOnly fallback={<div className="h-56 rounded bg-muted"/>}><div className="h-56 overflow-hidden"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows.map(r=>({ticker:r.ticker,value:r.values[metric]}))}><CartesianGrid vertical={false} stroke="var(--color-rule)"/><XAxis dataKey="ticker" tick={{fill:"var(--color-muted-foreground)",fontSize:12}}/><YAxis tickFormatter={v=>formatRatio(Number(v))} width={64} tick={{fill:"var(--color-muted-foreground)",fontSize:12}}/><Tooltip formatter={v=>formatRatio(Number(v))}/><Bar dataKey="value" maxBarSize={24} radius={[4,4,0,0]} isAnimationActive={false}>{rows.map((r,i)=><Cell key={r.cik} fill={i===0?"var(--color-chart-1)":"var(--color-chart-5)"}/>)}</Bar></BarChart></ResponsiveContainer></div></ClientOnly>
      <p className="text-xs text-muted-foreground">Whole-company trailing twelve-month figures; differing period ends are shown above. Company size and business mix may differ from the competing product line. No investment ranking is implied.</p>
    </>}
  </section>;
}