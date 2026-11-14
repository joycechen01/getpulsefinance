import { z } from "zod";
import { CALCULATED, valueOf, type Financials } from "./metrics";
import type { SignalView } from "./analysis.functions";
import { HEADLINE, fmtValue } from "./metric-config";
import { formatDate } from "./format";

export const digestInput = z.object({ ticker: z.string().trim().min(1).max(12).transform(t=>t.toUpperCase()) });
export type DigestFiling = { accession:string;form:string;filing_date:string;report_date:string|null;url:string };
export type EarningsDigest = {ticker:string;name:string;filing:DigestFiling;period:string;metrics:{label:string;value:string;kind:"fact"|"calc"}[];developments:SignalView[];reviewComplete:boolean};
export function latestEarnings<T extends {form:string;filing_date:string}>(filings:T[]):T|null {
  return filings.filter(f=>f.form==="10-Q"||f.form==="10-K").sort((a,b)=>b.filing_date.localeCompare(a.filing_date))[0]??null;
}
export function digestMetrics(fin:Financials|null,filing:DigestFiling) {
  const rows=fin?(filing.form==="10-K"?fin.annual:fin.quarterly):[];
  const row=rows.find(r=>r.end===filing.report_date);
  return {period:row?.label??(filing.report_date?`Period ended ${formatDate(filing.report_date)}`:"Period not reported"),metrics:HEADLINE.map(m=>({label:m.label,value:row?fmtValue(valueOf(rows,row,m.id),m.fmt,fin?.currency??"USD",1):"Not reported",kind:CALCULATED.has(m.id)||row?.derived.some(id=>id===m.id)||row?.calculated.some(id=>id===m.id)?"calc" as const:"fact" as const}))};
}
export function mailboxOwner(userEmail:string|undefined,mailbox:string) {return !!userEmail&&userEmail.trim().toLowerCase()===mailbox.trim().toLowerCase();}
export function digestMessageId(ticker:string,period:string) {return `pulse-earnings-${ticker.toLowerCase()}-${period.replace(/[^a-z0-9]/gi,"-").toLowerCase()}@pulsefinance.local`;}
export function digestText(d:EarningsDigest) {
  return [`Pulse Finance — Know what you own.`,`${d.name} (${d.ticker}) · ${d.period}`,`${d.filing.form} filed ${formatDate(d.filing.filing_date)}`,`SEC filing: ${d.filing.url}`,"",...d.metrics.map(m=>`[${m.kind==="calc"?"Calculated metric":"Disclosed fact"}] ${m.label}: ${m.value}`),"","Developments to watch",...d.developments.flatMap(s=>[`[AI interpretation] ${s.title}`,s.what_happened,...s.citations.map(c=>`Source: ${c.form} filed ${formatDate(c.filing_date)} — ${c.url??d.filing.url}\nPassage: ${c.text}`),`What remains uncertain: ${s.uncertain}`,""]),...(!d.developments.length?[d.reviewComplete?"No material developments detected in the reviewed filing evidence.":"Filing analysis is unavailable; developments have not been assessed."]:[]),"What remains uncertain: SEC disclosures may be incomplete or restated. This digest does not predict future results.","AI-generated analysis of SEC filings. Not investment advice."].join("\n");
}
const b64=(s:string)=>btoa(Array.from(new TextEncoder().encode(s),b=>String.fromCharCode(b)).join(""));
export function rawDigestEmail(d:EarningsDigest,to:string,messageId:string) {
  const address=z.string().email().parse(to);
  const subject=`Pulse Finance — ${d.ticker} ${d.period} earnings digest`;
  const message=[`To: ${address}`,`Subject: =?UTF-8?B?${b64(subject)}?=`,`Message-ID: <${messageId}>`,"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","",digestText(d)].join("\r\n");
  return b64(message).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}