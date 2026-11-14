import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { Button } from "@/components/ui/button";
import { getSharedRisks,type SharedRisksResult } from "@/lib/research.functions";
import { CitationItem } from "./SignalCard";

export function SharedRisksPanel({tickers}:{tickers:string[]}) {
  const get=useServerFn(getSharedRisks);
  const [requested,setRequested]=useState(false);
  const q=useQuery<SharedRisksResult>({queryKey:["shared-risks",...tickers],queryFn:()=>get(),enabled:requested,staleTime:30*60*1000,retry:false});
  return <section className="space-y-4 border-t pt-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2>Shared portfolio risks</h2><Button variant="outline" disabled={q.isFetching||tickers.length<2} onClick={()=>{setRequested(true);if(requested)q.refetch();}}>{q.isFetching?"Reading portfolio disclosures…":requested?"Refresh risk review":"Review shared risks"}</Button></div>
    {tickers.length<2?<p className="text-sm text-muted-foreground">Add a second holding to review shared disclosures.</p>:!requested?<p className="text-sm text-muted-foreground">Your portfolio’s annual risk disclosures have not been reviewed together yet.</p>:q.isFetching?<div className="space-y-2"><div className="h-32 rounded bg-muted"/><p className="text-sm text-muted-foreground">Reading annual filings for {tickers.join(", ")}…</p></div>:q.error||!q.data?.ok?<p className="text-sm">{q.data&&!q.data.ok?q.data.error:"The portfolio review could not finish. Try again."}</p>:<>
      <p className="text-xs text-muted-foreground">{q.data.reviewed.length} of {q.data.total} holdings reviewed · latest annual SEC risk factors. {q.data.unavailable.length?`Unavailable: ${q.data.unavailable.join(", ")}.`:""}</p>
      {!q.data.groups.length?<p className="text-sm text-muted-foreground">No shared specific exposures were found in the disclosures successfully reviewed; this is not proof that none exist.</p>:q.data.groups.map(g=><article key={g.key} className="panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-[15px]">{g.title}</h3><EvidenceBadge kind="ai"/></div><div className="mt-4 divide-y">{g.members.map(m=><div key={m.ticker} className="py-3"><Link to="/company/$ticker" params={{ticker:m.ticker}} className="text-sm font-medium">{m.ticker}</Link><p className="mt-2 text-sm">{m.risk.description}</p><ul className="mt-3 space-y-2">{m.citations.map(c=><CitationItem key={c.id} c={c}/>)}</ul><p className="mt-3 text-xs text-muted-foreground">What remains uncertain: {m.risk.uncertain}</p></div>)}</div><p className="mt-3 border-t pt-3 text-xs text-muted-foreground">A shared disclosure does not establish correlated outcomes or a portfolio loss estimate.</p></article>)}
    </>}
  </section>;
}