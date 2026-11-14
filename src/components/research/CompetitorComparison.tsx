import { useQuery } from "@tanstack/react-query";
import { useLayoutEffect, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
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
      {COMPARISON_METRICS.map(m=><TrendChart key={m.id} metric={m.id} label={m.label} term={m.term} rows={rows}/>)}
      <p className="text-xs text-muted-foreground">Whole-company trailing twelve-month figures; differing period ends are shown above. Company size and business mix may differ from the competing product line. No investment ranking is implied.</p>
    </>}
  </section>;
}

const ACCENT="var(--color-primary)";
const GREY="#868C95";
const INK="#1A1A17";
const RULE="#E4E0D6";
const ZERO="#B9B4A8";
const CHART_H=256;
const MARGIN={top:8,right:96,bottom:4,left:0};
const X_AXIS_H=28;

const CAPTIONS:Partial<Record<ComparisonMetric,string>>={
  revenueYoY:"Change in revenue versus the same quarter a year earlier. Companies are aligned to the nearest calendar quarter.",
  grossMargin:"Share of revenue left after the direct cost of sales. Companies are aligned to the nearest calendar quarter.",
};
const GENERIC_CAPTION="Companies are aligned to the nearest calendar quarter.";

function commonName(name:string,ticker:string){
  const cleaned=name.replace(/[,\s]+(INC|CORP|CORPORATION|CO|COMPANY|LTD|LLC|PLC|N\.?V\.?|S\.?A\.?|AG|SE|HOLDINGS?|GROUP)( CLASS [A-Z])?\.?$/gi,"").trim();
  if(!cleaned)return ticker;
  const pretty=cleaned.length<=4&&cleaned===cleaned.toUpperCase()?cleaned
    :cleaned===cleaned.toUpperCase()&&cleaned.length>6?cleaned.toLowerCase().replace(/(^|\s)[a-z]/g,c=>c.toUpperCase())
    :cleaned;
  return pretty.length>14?ticker:pretty;
}

function niceTicks(min:number,max:number){
  if(min===max){min-=0.05;max+=0.05;}
  const span=max-min;
  let step=[0.05,0.1,0.15,0.2,0.25,0.5,0.75,1,1.5,2].find(s=>span/s<=3)??Math.ceil(span/3);
  let lo=Math.floor(min/step)*step,hi=Math.ceil(max/step)*step;
  let ticks:number[]=[];
  for(let guard=0;guard<8;guard++){
    ticks=[];for(let t=lo;t<=hi+1e-9;t+=step)ticks.push(Number(t.toFixed(4)));
    if(ticks.length<=5)break;
    step*=2;lo=Math.floor(min/step)*step;hi=Math.ceil(max/step)*step;
  }
  return {lo,hi,ticks};
}

type Row=Extract<ComparisonResult,{ok:true}>["rows"][number];

function TrendTooltip({active,payload,label,rows}:{active?:boolean;payload?:Array<{dataKey?:string|number;value?:number|string|null;payload?:Record<string,unknown>}>;label?:string;rows:Row[]}){
  if(!active||!payload?.length)return null;
  const entries=payload.filter(p=>p.value!=null).map(p=>({key:String(p.dataKey),value:Number(p.value),end:(p.payload?.[`${String(p.dataKey)}__end`] as string|null)??null}));
  if(!entries.length)return null;
  const own=rows[0]?.ticker;
  entries.sort((a,b)=>a.key===own?-1:b.key===own?1:b.value-a.value);
  const rowByTicker=new Map(rows.map(r=>[r.ticker,r]));
  return <div style={{background:"#FFFFFF",border:`1px solid ${RULE}`,borderRadius:8,padding:"10px 12px",boxShadow:"none",minWidth:200}}>
    <div style={{color:INK,fontSize:13,fontWeight:500,marginBottom:6}}>{label}</div>
    {entries.map(e=>{const r=rowByTicker.get(e.key);const i=rows.findIndex(x=>x.ticker===e.key);return <div key={e.key} style={{marginBottom:6}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{width:10,height:3,borderRadius:2,background:i===0?ACCENT:GREY,flex:"none"}}/>
        <span style={{color:INK,fontSize:12,flex:1}}>{r?commonName(r.name,r.ticker):e.key}</span>
        <span className="figure" style={{color:INK,fontSize:12,textAlign:"right"}}>{formatRatio(e.value)}</span>
      </div>
      {e.end&&<div style={{color:GREY,fontSize:11,marginLeft:18}}>period ended {formatDate(e.end)}</div>}
    </div>;})}
  </div>;
}

function TrendChart({metric,label,term,rows}:{metric:ComparisonMetric;label:string;term:(typeof COMPARISON_METRICS)[number]["term"];rows:Row[]}){
  const wrapRef=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(0);
  const [hover,setHover]=useState<string|null>(null);
  useLayoutEffect(()=>{
    const el=wrapRef.current;if(!el)return;
    const ro=new ResizeObserver(es=>{const e=es[0];if(e)setWidth(e.contentRect.width);});
    ro.observe(el);setWidth(el.getBoundingClientRect().width);
    return ()=>ro.disconnect();
  },[]);
  const withData=rows.filter(r=>r.trend.some(p=>p.values[metric]!=null));
  const noData=rows.filter(r=>!r.trend.some(p=>p.values[metric]!=null));
  const quarters=[...new Set(withData.flatMap(r=>r.trend.map(p=>p.quarter)))].sort().slice(-12);
  const data=quarters.map(q=>{const o:Record<string,string|number|null>={quarter:q};for(const r of withData){const p=r.trend.find(x=>x.quarter===q);o[r.ticker]=p?.values[metric]??null;o[`${r.ticker}__end`]=p?.end??null;}return o;});
  const any=withData.length>0;
  const allValues=withData.flatMap(r=>r.trend.map(p=>p.values[metric]).filter((v):v is number=>v!=null));
  const {lo,hi,ticks}=any?niceTicks(Math.min(...allValues),Math.max(...allValues)):{lo:0,hi:1,ticks:[0,0.5,1]};
  const narrow=width>0&&width<560;
  const margin=narrow?{...MARGIN,right:12}:MARGIN;
  const plotH=CHART_H-margin.top-X_AXIS_H;
  const yFor=(v:number)=>margin.top+(1-(v-lo)/(hi-lo||1))*plotH;
  const endLabels=withData.map((r,i)=>{
    const pts=r.trend.filter(p=>p.values[metric]!=null&&quarters.includes(p.quarter));
    const last=pts[pts.length-1];
    return last?{ticker:r.ticker,name:commonName(r.name,r.ticker),value:last.values[metric] as number,own:i===0}:null;
  }).filter((x):x is NonNullable<typeof x>=>x!=null).sort((a,b)=>a.value-b.value);
  const placed:number[]=[];
  const labelPos=endLabels.map(l=>{
    let y=yFor(l.value);
    for(const p of placed)if(Math.abs(y-p)<14)y=p+14;
    placed.push(y);
    return {...l,y:Math.max(margin.top+6,Math.min(CHART_H-X_AXIS_H-6,y))};
  });
  const lineStyle=(r:Row,i:number)=>{
    const isHover=hover===r.ticker;
    return {stroke:i===0?ACCENT:isHover?INK:GREY,strokeWidth:i===0?2.5:isHover?2:1.5,strokeOpacity:hover&&i!==0&&!isHover?0.4:1};
  };
  return <section className="space-y-2 border-t pt-4">
    <h3 className="flex items-center gap-1 font-display">{label}<InfoTip term={term} title={label}/></h3>
    <p className="text-xs text-muted-foreground">{CAPTIONS[metric]??GENERIC_CAPTION}</p>
    {!any?<p className="text-sm text-muted-foreground">Not reported for the selected companies.</p>:
    <ClientOnly fallback={<div className="h-64 rounded bg-muted"/>}>
      <div ref={wrapRef} className="compare-chart relative">
        {narrow&&<div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">{withData.map((r,i)=><button key={r.cik} type="button" className="flex items-center gap-1.5 text-xs" style={{color:i===0?INK:GREY}} onMouseEnter={()=>setHover(r.ticker)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(r.ticker)} onBlur={()=>setHover(null)}><span style={{width:12,height:3,borderRadius:2,background:i===0?ACCENT:GREY}}/>{commonName(r.name,r.ticker)}</button>)}</div>}
        {width>0&&<LineChart width={width} height={CHART_H} data={data} margin={margin} onMouseLeave={()=>setHover(null)}>
          <CartesianGrid vertical={false} stroke={RULE} strokeWidth={1}/>
          {lo<0&&<ReferenceLine y={0} stroke={ZERO} strokeWidth={1}/>}
          <XAxis dataKey="quarter" tick={{fill:GREY,fontSize:12}} axisLine={false} tickLine={false} minTickGap={20} height={X_AXIS_H}/>
          <YAxis domain={[lo,hi]} ticks={ticks} tickFormatter={v=>`${Math.round(Number(v)*100)}%`} tick={{fill:GREY,fontSize:12}} axisLine={false} tickLine={false} width={44}/>
          <Tooltip content={<TrendTooltip rows={withData}/>} cursor={{stroke:RULE,strokeWidth:1}}/>
          {withData.map((r,i)=><Line key={r.cik} dataKey={r.ticker} name={r.ticker} {...lineStyle(r,i)} dot={false} activeDot={{r:3,strokeWidth:0}} connectNulls={false} isAnimationActive={false} onMouseEnter={()=>setHover(r.ticker)} onMouseLeave={()=>setHover(null)}/>)}
        </LineChart>}
        {!narrow&&width>0&&labelPos.map(l=><button key={l.ticker} type="button" onMouseEnter={()=>setHover(l.ticker)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(l.ticker)} onBlur={()=>setHover(null)} className="absolute truncate text-left" style={{top:l.y-7,right:0,width:margin.right-8,fontSize:12,lineHeight:"14px",color:l.own?INK:GREY,fontWeight:l.own?500:400}}>{l.name}</button>)}
      </div>
      {!!noData.length&&<p className="text-xs" style={{color:GREY}}>No comparable SEC data: {noData.map(r=>commonName(r.name,r.ticker)).join(", ")}</p>}
    </ClientOnly>}
  </section>;
}
