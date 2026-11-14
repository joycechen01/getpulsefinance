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
  return [`Pulse Finance — Know what you own.`,`${d.name} (${d.ticker}) · ${d.period}`,`${d.filing.form} filed ${formatDate(d.filing.filing_date)}`,`SEC filing: ${d.filing.url}`,"",...d.metrics.map(m=>`[${m.kind==="calc"?"Calculated metric":"Disclosed fact"}] ${m.label}: ${m.value}\nSource: ${d.filing.url}`),"","Developments to watch",...d.developments.flatMap(s=>[`[AI interpretation] ${s.title}`,s.what_happened,...s.citations.map(c=>`Source: ${c.form} filed ${formatDate(c.filing_date)} — ${c.url??d.filing.url}\nPassage: ${c.text}`),`What remains uncertain: ${s.uncertain}`,""]),...(!d.developments.length?[d.reviewComplete?"No material developments detected in the reviewed filing evidence.":"Filing analysis is unavailable; developments have not been assessed."]:[]),"What remains uncertain: SEC disclosures may be incomplete or restated. This digest does not predict future results.","AI-generated summary of SEC filings. Not investment advice.","Open full analysis: https://getpulsefinance.lovable.app/company/"+encodeURIComponent(d.ticker),"Unsubscribe: https://getpulsefinance.lovable.app/settings (turn off Earnings digest emails)."].join("\n");
}
export const EMAIL_THEME={paper:"#F7F5F0",ink:"#0F1B2D",surface:"#FFFFFF",rule:"#E4E0D6",teal:"#1F6F78",secondary:"#5B6470"};
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]??c));
export function digestHtml(d:EarningsDigest){
  const t=EMAIL_THEME;
  return `<html><body style="margin:0;background:${t.paper};color:${t.ink};font-family:Arial,sans-serif;font-size:15px;line-height:1.6"><div style="max-width:600px;margin:24px auto;padding:24px;background:${t.surface};border:1px solid ${t.rule}"><p style="font-size:17px">Pulse Finance</p><h1 style="font-family:Georgia,serif;font-weight:500;font-size:24px">${escapeHtml(d.name)} · ${escapeHtml(d.period)}</h1><p>${escapeHtml(d.filing.form)} filed ${formatDate(d.filing.filing_date)} · <a style="color:${t.teal}" href="${escapeHtml(d.filing.url)}">SEC filing</a></p>${d.metrics.map(m=>`<p>[${m.kind==="calc"?"Calculated metric":"Disclosed fact"}] ${escapeHtml(m.label)}: ${escapeHtml(m.value)} · <a style="color:${t.teal}" href="${escapeHtml(d.filing.url)}">Source</a></p>`).join("")}<h2 style="font-family:Georgia,serif;font-weight:500;font-size:20px">Developments to watch</h2>${d.developments.map(s=>`<p>[AI interpretation] ${escapeHtml(s.title)}</p><p>${escapeHtml(s.what_happened)}</p>${s.citations.map(c=>`<p style="font-size:12px"><a style="color:${t.teal}" href="${escapeHtml(c.url??d.filing.url)}">${escapeHtml(c.form)} filed ${formatDate(c.filing_date)} — source passage</a></p>`).join("")}<p>What remains uncertain: ${escapeHtml(s.uncertain)}</p>`).join("")||"<p>No material developments detected in the reviewed evidence.</p>"}<p>What remains uncertain: SEC disclosures may be incomplete or restated. This digest does not predict future results.</p><p><a href="https://getpulsefinance.lovable.app/company/${encodeURIComponent(d.ticker)}" style="display:inline-block;padding:8px 16px;background:${t.ink};color:${t.paper};text-decoration:none;border-radius:6px">Open full analysis</a></p><p style="font-size:12px;color:${t.secondary}">AI-generated summary of SEC filings. Not investment advice.<br><a style="color:${t.teal}" href="https://getpulsefinance.lovable.app/settings">Unsubscribe in delivery settings</a></p></div></body></html>`;
}
const b64=(s:string)=>btoa(Array.from(new TextEncoder().encode(s),b=>String.fromCharCode(b)).join(""));
export function rawDigestEmail(d:EarningsDigest,to:string,messageId:string) {
  const address=z.string().email().parse(to);
  const subject=`Pulse Finance — ${d.ticker} ${d.period} earnings digest`;
  const boundary="pulse_"+messageId.replace(/[^a-z0-9]/gi,"_");
  const message=[`To: ${address}`,`Subject: =?UTF-8?B?${b64(subject)}?=`,`Message-ID: <${messageId}>`,"MIME-Version: 1.0",`Content-Type: multipart/alternative; boundary="${boundary}"`,"",`--${boundary}`,"Content-Type: text/plain; charset=UTF-8","",digestText(d),`--${boundary}`,"Content-Type: text/html; charset=UTF-8","",digestHtml(d),`--${boundary}--`].join("\r\n");
  return b64(message).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}