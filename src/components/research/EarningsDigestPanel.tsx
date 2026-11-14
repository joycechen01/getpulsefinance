import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail,FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { previewDigest,sendDigest,type DigestResult } from "@/lib/digest.functions";
import { formatDate } from "@/lib/format";
import { CitationItem } from "./SignalCard";

export function EarningsDigestPanel({tickers}:{tickers:string[]}) {
  const [ticker,setTicker]=useState(tickers[0]??"");
  const [result,setResult]=useState<DigestResult|null>(null);
  const [busy,setBusy]=useState<"preview"|"send"|null>(null);
  const [message,setMessage]=useState("");
  const preview=useServerFn(previewDigest),send=useServerFn(sendDigest);
  const digest=result?.ok?result.digest:null;
  return <section className="space-y-4 border-y py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2>Latest earnings digest</h2><div className="flex flex-wrap gap-2"><Select value={ticker} onValueChange={t=>{setTicker(t);setResult(null);setMessage("");}}><SelectTrigger className="w-28" aria-label="Digest company"><SelectValue placeholder="Company"/></SelectTrigger><SelectContent>{tickers.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={!!busy||!ticker} onClick={async()=>{setBusy("preview");setMessage("");try{setResult(await preview({data:{ticker}}));}catch{setMessage("The digest could not be prepared. Try again.");}finally{setBusy(null);}}}><FileText/>{busy==="preview"?"Reading SEC filings…":"Preview digest"}</Button></div></div>
    {!tickers.length&&<p className="text-sm text-muted-foreground">Add a holding to prepare an earnings digest.</p>}
    {busy==="preview"&&<div className="h-32 rounded bg-muted"/>}
    {result&&!result.ok&&<p role="alert" className="text-sm">{result.error}</p>}
    {digest&&<div className="space-y-4"><div><h3>{digest.name} · {digest.period}</h3><a href={digest.filing.url} target="_blank" rel="noreferrer" className="text-xs">{digest.filing.form} filed {formatDate(digest.filing.filing_date)} · SEC source</a></div><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{digest.metrics.map(m=><div key={m.label} className="border-b pb-3"><dt className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{m.label}<EvidenceBadge kind={m.kind} compact/></dt><dd className="figure mt-2 text-lg">{m.value}</dd></div>)}</dl><h3>Developments to watch</h3>{digest.developments.map(s=><article key={s.id} className="space-y-3 border-b pb-4"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm">{s.title}</h3><EvidenceBadge kind="ai"/></div><p className="text-sm">{s.what_happened}</p><ul className="space-y-2">{s.citations.map(c=><CitationItem key={c.id} c={c}/>)}</ul><p className="text-xs text-muted-foreground">What remains uncertain: {s.uncertain}</p></article>)}{!digest.developments.length&&<p className="text-sm text-muted-foreground">{digest.reviewComplete?"No material developments detected in the reviewed evidence.":"Developments have not been assessed; the analysis is unavailable."}</p>}<div className="flex flex-wrap items-center gap-4"><Button disabled={!!busy||!digest.reviewComplete} onClick={async()=>{setBusy("send");try{const r=await send({data:{ticker:digest.ticker}});setMessage(r.ok?r.alreadySent?"This company’s digest has already been sent for this period.":`Gmail accepted the digest for ${r.recipient}.`:r.error);}catch{setMessage("The send could not be confirmed. Check Gmail Sent mail before retrying.");}finally{setBusy(null);}}}><Mail/>{busy==="send"?"Sending…":"Email this digest"}</Button><Link to="/settings" className="text-xs">Delivery settings</Link></div></div>}
    {message&&<p role="status" className="text-sm">{message}</p>}
  </section>;
}